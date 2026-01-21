import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { collection, getDocs, query, orderBy, addDoc, deleteDoc, doc, Timestamp, updateDoc, writeBatch, where, limit, startAfter, getDoc } from 'firebase/firestore';
import { db } from '../../api/firebase/config';
import { 
  Database, Upload, Trash2, Loader2, Sparkles, Clock, AlertCircle, CheckCircle, 
  RefreshCw, Eye, ChevronLeft, ChevronRight, X, Columns, Send, Download,
  Plus, List, FileSpreadsheet, Wand2
} from 'lucide-react';

// Types
interface LeadList {
  id: string;
  name: string;
  columns: string[];
  rowCount: number;
  createdAt: Timestamp | Date;
  updatedAt?: Timestamp | Date;
}

interface LeadItem {
  id: string;
  listId: string;
  data: Record<string, string>;
  createdAt: Timestamp | Date;
}

// Utility function to format Firestore Timestamps or Dates
const formatDate = (date: Timestamp | Date | undefined): string => {
  if (!date) return 'N/A';
  let dateObject: Date;
  if (date instanceof Timestamp) {
    dateObject = date.toDate();
  } else if (date instanceof Date) {
    dateObject = date;
  } else {
    return 'Invalid Date';
  }
  return dateObject.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit' 
  });
};

// Parse Excel file (XLSX, XLS)
const parseExcel = async (file: File): Promise<{ headers: string[]; rows: Record<string, string>[] }> => {
  // Dynamically import xlsx library
  const XLSX = await import('xlsx');
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Get first sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON with header row
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][];
        
        if (jsonData.length === 0) {
          reject(new Error('Excel file is empty'));
          return;
        }
        
        // First row is headers
        const headers = jsonData[0].map((h: any) => String(h || '').trim()).filter((h: string) => h);
        
        if (headers.length === 0) {
          reject(new Error('No headers found in Excel file'));
          return;
        }
        
        // Convert rows to objects
        const rows: Record<string, string>[] = [];
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          const rowObj: Record<string, string> = {};
          headers.forEach((header, index) => {
            rowObj[header] = String(row[index] || '').trim();
          });
          // Only add row if it has at least one non-empty value
          if (Object.values(rowObj).some(v => v)) {
            rows.push(rowObj);
          }
        }
        
        resolve({ headers, rows });
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read Excel file'));
    };
    
    reader.readAsArrayBuffer(file);
  });
};

// Simple CSV parser (handles quoted fields with commas)
const parseCSV = (csvText: string): { headers: string[]; rows: Record<string, string>[] } => {
  const lines = csvText.trim().split('\n');
  if (lines.length === 0) return { headers: [], rows: [] };

  // Parse a single line respecting quoted fields
  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    if (values.length === headers.length) {
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      rows.push(row);
    }
  }

  return { headers, rows };
};

const ROWS_PER_PAGE = 100;

const LeadMassagingAdmin: React.FC = () => {
  // Lead Lists State
  const [leadLists, setLeadLists] = useState<LeadList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Create List Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [csvInput, setCsvInput] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number } | null>(null);

  // Lead Items State
  const [leadItems, setLeadItems] = useState<LeadItem[]>([]);
  const [allLeadItems, setAllLeadItems] = useState<LeadItem[]>([]); // Store all leads for counting
  const [loadingItems, setLoadingItems] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Sorting State
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Transform Modal State
  const [isTransformModalOpen, setIsTransformModalOpen] = useState(false);
  const [sourceColumns, setSourceColumns] = useState<string[]>([]);
  const [transformPrompt, setTransformPrompt] = useState('');
  const [newColumnName, setNewColumnName] = useState('');
  const [columnMode, setColumnMode] = useState<'new' | 'existing'>('new');
  const [selectedExistingColumn, setSelectedExistingColumn] = useState<string>('');
  const [isTransforming, setIsTransforming] = useState(false);
  const [transformProgress, setTransformProgress] = useState<{ current: number; total: number } | null>(null);
  const [tokenEstimate, setTokenEstimate] = useState<{ inputTokens: number; outputTokens: number; estimatedCost: number } | null>(null);

  // Push to Instantly Modal State
  const [isPushModalOpen, setIsPushModalOpen] = useState(false);
  const [campaignId, setCampaignId] = useState('');
  const [emailColumn, setEmailColumn] = useState('');
  const [firstNameColumn, setFirstNameColumn] = useState('');
  const [lastNameColumn, setLastNameColumn] = useState('');
  const [companyColumn, setCompanyColumn] = useState('');
  const [customVariableColumns, setCustomVariableColumns] = useState<string[]>([]);
  const [isPushing, setIsPushing] = useState(false);
  const [pushProgress, setPushProgress] = useState<{ current: number; total: number; success: number; failed: number } | null>(null);

  // Deleting state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Get selected list
  const selectedList = leadLists.find(l => l.id === selectedListId);

  // Sort lead items based on selected column
  const sortedLeadItems = useMemo(() => {
    if (!sortColumn) return leadItems;
    
    return [...leadItems].sort((a, b) => {
      const aValue = a.data[sortColumn] || '';
      const bValue = b.data[sortColumn] || '';
      
      // Handle numeric values
      const aNum = parseFloat(aValue);
      const bNum = parseFloat(bValue);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
      }
      
      // Handle string values
      const comparison = aValue.localeCompare(bValue, undefined, { numeric: true, sensitivity: 'base' });
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [leadItems, sortColumn, sortDirection]);

  // Estimate token usage for transformation
  const estimateTokenUsage = useCallback(async () => {
    const currentSelectedList = leadLists.find(l => l.id === selectedListId);
    
    if (!selectedListId || sourceColumns.length === 0 || !transformPrompt.trim() || !currentSelectedList) {
      setTokenEstimate(null);
      return;
    }

    try {
      // Sample a few leads to estimate average data length
      const sampleQuery = query(
        collection(db, 'lead-list-items'),
        where('listId', '==', selectedListId),
        limit(10)
      );
      const sampleSnapshot = await getDocs(sampleQuery);
      const sampleLeads = sampleSnapshot.docs.map(doc => doc.data().data as Record<string, string>);

      // Calculate average data length per lead for selected columns
      let totalDataLength = 0;
      let sampleCount = 0;
      
      sampleLeads.forEach(lead => {
        const columnData = sourceColumns.map(col => {
          const value = lead[col] || '';
          return sourceColumns.length === 1 
            ? value 
            : `${col}: "${value}"`;
        }).join('\n');
        totalDataLength += columnData.length;
        sampleCount++;
      });

      const avgDataLength = sampleCount > 0 ? totalDataLength / sampleCount : 100; // Default estimate
      const totalLeads = currentSelectedList.rowCount || 0;

      // System prompt (approximate)
      const systemPrompt = `You are a data transformation assistant. Your job is to transform text data based on user instructions. 
                  
CRITICAL RULES:
- Output ONLY the transformed text, nothing else
- Do not include quotes, labels, or explanations
- Keep responses concise and direct
- If the input is empty or unclear, output an empty string
- You have access to multiple data columns - use all of them as needed based on the instructions`;

      // User prompt template
      const userPromptTemplate = sourceColumns.length === 1
        ? `Transform this text according to the instructions:

INPUT TEXT: "${'X'.repeat(Math.ceil(avgDataLength))}"

INSTRUCTIONS: ${transformPrompt}

OUTPUT:`
        : `Transform the following data according to the instructions:

INPUT DATA:
${'X'.repeat(Math.ceil(avgDataLength))}

INSTRUCTIONS: ${transformPrompt}

OUTPUT:`;

      // Rough token estimation: ~4 characters per token for English text
      const charsPerToken = 4;
      const systemTokens = Math.ceil(systemPrompt.length / charsPerToken);
      const userPromptBaseTokens = Math.ceil((userPromptTemplate.length - avgDataLength) / charsPerToken);
      const avgDataTokens = Math.ceil(avgDataLength / charsPerToken);
      const userPromptTokensPerLead = userPromptBaseTokens + avgDataTokens;

      // Total input tokens (system + user prompts for all leads)
      const inputTokensPerLead = systemTokens + userPromptTokensPerLead;
      const totalInputTokens = inputTokensPerLead * totalLeads;

      // Output tokens (max_tokens is 150, but average will be less)
      const estimatedOutputTokensPerLead = 50; // Conservative estimate
      const totalOutputTokens = estimatedOutputTokensPerLead * totalLeads;

      // Cost estimation for gpt-4o-mini (as of 2024)
      // Input: $0.15 per 1M tokens
      // Output: $0.60 per 1M tokens
      const inputCostPerMillion = 0.15;
      const outputCostPerMillion = 0.60;
      const estimatedCost = 
        (totalInputTokens / 1_000_000) * inputCostPerMillion +
        (totalOutputTokens / 1_000_000) * outputCostPerMillion;

      setTokenEstimate({
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        estimatedCost
      });
    } catch (error) {
      console.error('Error estimating tokens:', error);
      setTokenEstimate(null);
    }
  }, [selectedListId, sourceColumns, transformPrompt, leadLists]);

  // Update token estimate when relevant fields change
  useEffect(() => {
    if (isTransformModalOpen && selectedListId) {
      const timeoutId = setTimeout(() => {
        estimateTokenUsage();
      }, 500); // Debounce

      return () => clearTimeout(timeoutId);
    } else {
      setTokenEstimate(null);
    }
  }, [isTransformModalOpen, selectedListId, sourceColumns, transformPrompt, estimateTokenUsage]);

  // Load lead lists
  const loadLeadLists = useCallback(async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'lead-lists'),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const lists = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as LeadList[];
      setLeadLists(lists);
    } catch (error) {
      console.error('Error loading lead lists:', error);
      setMessage({ type: 'error', text: 'Failed to load lead lists' });
    } finally {
      setLoading(false);
    }
  }, []);

  // Load lead items for selected list
  const loadLeadItems = useCallback(async (listId: string, page: number = 1) => {
    setLoadingItems(true);
    try {
      // Get total count from the list document
      const listDoc = await getDoc(doc(db, 'lead-lists', listId));
      const listData = listDoc.data() as LeadList | undefined;
      const totalRows = listData?.rowCount || 0;
      setTotalPages(Math.ceil(totalRows / ROWS_PER_PAGE));

      // Query items with pagination
      const q = query(
        collection(db, 'lead-list-items'),
        where('listId', '==', listId),
        orderBy('createdAt', 'asc'),
        limit(ROWS_PER_PAGE)
      );

      // For pages > 1, we need to get the last doc from previous page
      // For simplicity, we'll fetch all and slice (can optimize later with cursors)
      const allItemsQuery = query(
        collection(db, 'lead-list-items'),
        where('listId', '==', listId),
        orderBy('createdAt', 'asc')
      );
      
      const snapshot = await getDocs(allItemsQuery);
      const allItems = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as LeadItem[];

      // Store all items for counting
      setAllLeadItems(allItems);

      // Slice for pagination
      const startIndex = (page - 1) * ROWS_PER_PAGE;
      const endIndex = startIndex + ROWS_PER_PAGE;
      setLeadItems(allItems.slice(startIndex, endIndex));
      setCurrentPage(page);
    } catch (error) {
      console.error('Error loading lead items:', error);
      setMessage({ type: 'error', text: 'Failed to load lead data' });
    } finally {
      setLoadingItems(false);
    }
  }, []);

  useEffect(() => {
    loadLeadLists();
  }, [loadLeadLists]);

  useEffect(() => {
    if (selectedListId) {
      loadLeadItems(selectedListId, 1);
    } else {
      setLeadItems([]);
    }
  }, [selectedListId, loadLeadItems]);

  // Auto-dismiss messages
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // Handle file drop
  const handleFileDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  // Handle file select
  const handleFileSelect = async (file: File) => {
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!validExtensions.includes(fileExtension)) {
      setMessage({ type: 'error', text: 'Please upload a valid Excel (.xlsx, .xls) or CSV file' });
      return;
    }
    
    setUploadedFile(file);
    setCsvInput(''); // Clear CSV input when file is selected
  };

  // Import data (CSV or Excel)
  const handleImportCSV = async () => {
    if (!newListName.trim()) {
      setMessage({ type: 'error', text: 'Please enter a list name' });
      return;
    }
    
    if (!uploadedFile && !csvInput.trim()) {
      setMessage({ type: 'error', text: 'Please upload an Excel file or paste CSV data' });
      return;
    }

    setIsImporting(true);
    setImportProgress(null);

    try {
      let headers: string[];
      let rows: Record<string, string>[];
      
      if (uploadedFile) {
        // Parse Excel file
        const fileExtension = '.' + uploadedFile.name.split('.').pop()?.toLowerCase();
        if (fileExtension === '.csv') {
          // Read CSV file as text
          const text = await uploadedFile.text();
          const parsed = parseCSV(text);
          headers = parsed.headers;
          rows = parsed.rows;
        } else {
          // Parse Excel file
          const parsed = await parseExcel(uploadedFile);
          headers = parsed.headers;
          rows = parsed.rows;
        }
      } else {
        // Parse CSV from text input
        const parsed = parseCSV(csvInput);
        headers = parsed.headers;
        rows = parsed.rows;
      }
      
      if (headers.length === 0) {
        throw new Error('No headers found in CSV');
      }
      if (rows.length === 0) {
        throw new Error('No data rows found in CSV');
      }

      // Create the lead list document
      const listRef = await addDoc(collection(db, 'lead-lists'), {
        name: newListName.trim(),
        columns: headers,
        rowCount: rows.length,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });

      // Batch write the items (500 per batch - Firestore limit)
      const BATCH_SIZE = 500;
      let processed = 0;
      
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const batchRows = rows.slice(i, i + BATCH_SIZE);
        
        batchRows.forEach((row) => {
          const itemRef = doc(collection(db, 'lead-list-items'));
          batch.set(itemRef, {
            listId: listRef.id,
            data: row,
            createdAt: Timestamp.now()
          });
        });
        
        await batch.commit();
        processed += batchRows.length;
        setImportProgress({ current: processed, total: rows.length });
      }

      setMessage({ type: 'success', text: `Successfully imported ${rows.length} leads into "${newListName}"` });
      setIsCreateModalOpen(false);
      setNewListName('');
      setCsvInput('');
      setUploadedFile(null);
      loadLeadLists();
      setSelectedListId(listRef.id);
    } catch (error) {
      console.error('Error importing CSV:', error);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to import CSV' });
    } finally {
      setIsImporting(false);
      setImportProgress(null);
    }
  };

  // Delete lead list
  const handleDeleteList = async (listId: string) => {
    if (!confirm('Are you sure you want to delete this lead list? This will delete all leads in the list.')) return;

    setDeletingId(listId);
    try {
      // Delete all items in the list
      const itemsQuery = query(
        collection(db, 'lead-list-items'),
        where('listId', '==', listId)
      );
      const itemsSnapshot = await getDocs(itemsQuery);
      
      // Batch delete items
      const BATCH_SIZE = 500;
      const items = itemsSnapshot.docs;
      
      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const batchItems = items.slice(i, i + BATCH_SIZE);
        batchItems.forEach((item) => {
          batch.delete(item.ref);
        });
        await batch.commit();
      }

      // Delete the list document
      await deleteDoc(doc(db, 'lead-lists', listId));

      if (selectedListId === listId) {
        setSelectedListId(null);
      }
      
      setMessage({ type: 'success', text: 'Lead list deleted successfully' });
      loadLeadLists();
    } catch (error) {
      console.error('Error deleting lead list:', error);
      setMessage({ type: 'error', text: 'Failed to delete lead list' });
    } finally {
      setDeletingId(null);
    }
  };

  // Transform column with AI
  const handleTransformColumn = async () => {
    if (!selectedListId || sourceColumns.length === 0 || !transformPrompt.trim()) {
      setMessage({ type: 'error', text: 'Please select at least one source column and provide a transformation prompt' });
      return;
    }

    // Determine the target column name
    const targetColumnName = columnMode === 'new' 
      ? newColumnName.trim()
      : selectedExistingColumn;

    if (!targetColumnName) {
      setMessage({ type: 'error', text: columnMode === 'new' 
        ? 'Please enter a new column name' 
        : 'Please select an existing column to update' });
      return;
    }

    // For new columns, check if name already exists
    if (columnMode === 'new' && selectedList?.columns.includes(targetColumnName)) {
      setMessage({ type: 'error', text: 'Column name already exists. Please select "Update Existing Column" instead or choose a different name.' });
      return;
    }

    setIsTransforming(true);
    setTransformProgress(null);

    try {
      const response = await fetch('/.netlify/functions/massage-lead-column', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listId: selectedListId,
          sourceColumns, // Send array of columns
          newColumnName: targetColumnName,
          prompt: transformPrompt.trim()
        })
      });

      // Check if response is OK and is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('[handleTransformColumn] Non-JSON response:', {
          status: response.status,
          statusText: response.statusText,
          contentType,
          bodyPreview: text.substring(0, 200)
        });
        
        if (response.status === 504 || response.status === 502) {
          throw new Error('Request timed out. The transformation is taking too long. Please try again - it will continue from where it left off.');
        }
        throw new Error(`Server returned ${response.status}: ${response.statusText}. Response was not JSON.`);
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to transform column');
      }

      // Show detailed toast message
      let toastMessage = '';
      if (result.partial) {
        toastMessage = `Partially completed: ${result.processedCount} of ${result.totalLeads} leads transformed. ${result.remainingLeads} remaining. ${result.message || 'Run again to continue.'}`;
      } else {
        const actionText = columnMode === 'new' ? 'created' : 'updated';
        toastMessage = `✅ Successfully ${actionText} ${result.processedCount} of ${result.totalLeads} leads in "${targetColumnName}"${result.errorCount > 0 ? ` (${result.errorCount} errors)` : ''}`;
      }

      setMessage({ type: 'success', text: toastMessage });
      
      // Auto-dismiss toast after 5 seconds
      setTimeout(() => {
        setMessage(null);
      }, 5000);

      setIsTransformModalOpen(false);
      setSourceColumns([]);
      setNewColumnName('');
      setSelectedExistingColumn('');
      setColumnMode('new');
      setTransformPrompt('');
      
      // Reload data
      loadLeadLists();
      loadLeadItems(selectedListId, currentPage);
    } catch (error) {
      console.error('Error transforming column:', error);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to transform column' });
    } finally {
      setIsTransforming(false);
      setTransformProgress(null);
    }
  };

  // Push to Instantly
  const handlePushToInstantly = async () => {
    if (!selectedListId || !campaignId.trim() || !emailColumn) {
      setMessage({ type: 'error', text: 'Please enter Campaign ID and select the email column' });
      return;
    }

    setIsPushing(true);
    setPushProgress(null);

    try {
      const response = await fetch('/.netlify/functions/push-leads-to-instantly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listId: selectedListId,
          campaignId: campaignId.trim(),
          columnMapping: {
            email: emailColumn,
            firstName: firstNameColumn || undefined,
            lastName: lastNameColumn || undefined,
            companyName: companyColumn || undefined
          },
          customVariables: customVariableColumns
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to push leads to Instantly');
      }

      setMessage({ 
        type: 'success', 
        text: `Successfully pushed ${result.successCount} leads to Instantly${result.failedCount > 0 ? ` (${result.failedCount} failed)` : ''}` 
      });
      setIsPushModalOpen(false);
    } catch (error) {
      console.error('Error pushing to Instantly:', error);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to push leads' });
    } finally {
      setIsPushing(false);
      setPushProgress(null);
    }
  };

  // Toggle custom variable column selection
  const toggleCustomVariable = (column: string) => {
    setCustomVariableColumns(prev => 
      prev.includes(column) 
        ? prev.filter(c => c !== column)
        : [...prev, column]
    );
  };

  return (
    <AdminRouteGuard>
      <Head>
        <title>Lead Massaging Tool | Pulse Admin</title>
      </Head>
      
      <div className="min-h-screen bg-[#111417] text-white py-10 px-4">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Database className="w-7 h-7 text-[#d7ff00]" />
                Lead Massaging Tool
              </h1>
              <p className="text-zinc-400 mt-1">
                Import, transform, and push leads to Instantly
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={loadLeadLists}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-[#d7ff00] text-black hover:bg-[#c5eb00] rounded-lg font-semibold transition-colors"
              >
                <Plus className="w-4 h-4" />
                New Lead List
              </button>
            </div>
          </div>

          {/* Toast Notification */}
          {message && (
            <div className={`fixed top-4 right-4 z-[100] p-4 rounded-xl border shadow-lg max-w-md animate-in slide-in-from-top-5 ${
              message.type === 'success' 
                ? 'bg-green-900/95 border-green-700 text-green-100'
                : message.type === 'error'
                ? 'bg-red-900/95 border-red-700 text-red-100'
                : 'bg-blue-900/95 border-blue-700 text-blue-100'
            }`}>
              <div className="flex items-start gap-3">
                {message.type === 'success' ? <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" /> : 
                 message.type === 'error' ? <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" /> : 
                 <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />}
                <p className="text-sm flex-1">{message.text}</p>
                <button
                  onClick={() => setMessage(null)}
                  className="text-zinc-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Lead Lists Sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-[#1a1e24] rounded-xl border border-zinc-800 overflow-hidden">
                <div className="p-4 border-b border-zinc-800">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <List className="w-5 h-5 text-zinc-400" />
                    Lead Lists
                    <span className="ml-auto px-2 py-0.5 bg-zinc-800 rounded-full text-xs text-zinc-400">
                      {leadLists.length}
                    </span>
                  </h2>
                </div>

                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-[#d7ff00]" />
                  </div>
                ) : leadLists.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-zinc-500 px-4">
                    <FileSpreadsheet className="w-10 h-10 mb-3 opacity-50" />
                    <p className="text-sm text-center">No lead lists yet</p>
                    <p className="text-xs text-center mt-1">Create one to get started</p>
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-800 max-h-[500px] overflow-y-auto">
                    {leadLists.map((list) => (
                      <div
                        key={list.id}
                        className={`p-4 cursor-pointer transition-colors ${
                          selectedListId === list.id 
                            ? 'bg-[#d7ff00]/10 border-l-2 border-l-[#d7ff00]' 
                            : 'hover:bg-zinc-900/50'
                        }`}
                        onClick={() => setSelectedListId(list.id)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-medium text-white truncate">{list.name}</h3>
                            <p className="text-xs text-zinc-500 mt-1">
                              {list.rowCount.toLocaleString()} leads • {list.columns.length} columns
                            </p>
                            <p className="text-xs text-zinc-600 mt-0.5">
                              {formatDate(list.createdAt)}
                            </p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteList(list.id);
                            }}
                            disabled={deletingId === list.id}
                            className="p-1.5 hover:bg-red-900/30 rounded-lg transition-colors"
                          >
                            {deletingId === list.id ? (
                              <Loader2 className="w-4 h-4 animate-spin text-red-400" />
                            ) : (
                              <Trash2 className="w-4 h-4 text-red-400" />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Main Content Area */}
            <div className="lg:col-span-3">
              {!selectedListId ? (
                <div className="bg-[#1a1e24] rounded-xl border border-zinc-800 flex flex-col items-center justify-center py-20 text-zinc-500">
                  <Database className="w-16 h-16 mb-4 opacity-30" />
                  <p className="text-lg">Select a lead list to view data</p>
                  <p className="text-sm mt-1">or create a new one to get started</p>
                </div>
              ) : (
                <div className="bg-[#1a1e24] rounded-xl border border-zinc-800 overflow-hidden">
                  {/* Actions Bar */}
                  <div className="p-4 border-b border-zinc-800 flex items-center justify-between flex-wrap gap-4">
                    <div>
                      <h2 className="text-lg font-semibold text-white">{selectedList?.name}</h2>
                      <p className="text-sm text-zinc-500">
                        {selectedList?.rowCount.toLocaleString()} leads • {selectedList?.columns.length} columns
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSourceColumns([]);
                          setNewColumnName('');
                          setTransformPrompt('');
                          setIsTransformModalOpen(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium transition-colors"
                      >
                        <Wand2 className="w-4 h-4" />
                        Transform Column
                      </button>
                      <button
                        onClick={() => {
                          setEmailColumn('');
                          setFirstNameColumn('');
                          setLastNameColumn('');
                          setCompanyColumn('');
                          setCustomVariableColumns([]);
                          setCampaignId('');
                          setIsPushModalOpen(true);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-medium transition-colors"
                      >
                        <Send className="w-4 h-4" />
                        Push to Instantly
                      </button>
                    </div>
                  </div>

                  {/* Column Headers Display */}
                  {selectedList && (
                    <div className="px-4 py-2 bg-zinc-900/50 border-b border-zinc-800">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-zinc-500">Columns:</span>
                        {selectedList.columns.map((col) => {
                          // Count non-empty values for this column across ALL leads
                          const valueCount = allLeadItems.filter(item => {
                            const value = item.data[col];
                            return value !== undefined && value !== null && value !== '';
                          }).length;
                          
                          const isSorted = sortColumn === col;
                          const isAsc = sortDirection === 'asc';
                          
                          return (
                            <button
                              key={col}
                              onClick={() => {
                                if (isSorted && isAsc) {
                                  setSortDirection('desc');
                                } else if (isSorted && !isAsc) {
                                  setSortColumn(null);
                                  setSortDirection('asc');
                                } else {
                                  setSortColumn(col);
                                  setSortDirection('asc');
                                }
                              }}
                              className={`px-2 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1.5 ${
                                isSorted
                                  ? 'bg-purple-600 text-white'
                                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                              }`}
                            >
                              <span>{col}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                                isSorted
                                  ? 'bg-purple-700 text-purple-100'
                                  : 'bg-zinc-700 text-zinc-400'
                              }`}>
                                {valueCount.toLocaleString()}
                              </span>
                              {isSorted && (
                                <span className="text-[10px]">
                                  {isAsc ? '↑' : '↓'}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Data Table */}
                  {loadingItems ? (
                    <div className="flex items-center justify-center py-20">
                      <Loader2 className="w-8 h-8 animate-spin text-[#d7ff00]" />
                    </div>
                  ) : leadItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
                      <FileSpreadsheet className="w-12 h-12 mb-4 opacity-50" />
                      <p>No data in this list</p>
                    </div>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-zinc-900/70">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider whitespace-nowrap">
                                #
                              </th>
                              {selectedList?.columns.map((col) => (
                                <th key={col} className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider whitespace-nowrap">
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-800">
                            {sortedLeadItems.map((item, index) => (
                              <tr key={item.id} className="hover:bg-zinc-900/30">
                                <td className="px-4 py-3 text-zinc-500 whitespace-nowrap">
                                  {(currentPage - 1) * ROWS_PER_PAGE + index + 1}
                                </td>
                                {selectedList?.columns.map((col) => (
                                  <td key={col} className={`px-4 py-3 text-zinc-300 max-w-xs truncate ${sortColumn === col ? 'bg-purple-900/10' : ''}`} title={item.data[col] || ''}>
                                    {item.data[col] || '-'}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination */}
                      <div className="p-4 border-t border-zinc-800 flex items-center justify-between">
                        <p className="text-sm text-zinc-500">
                          Showing {(currentPage - 1) * ROWS_PER_PAGE + 1} - {Math.min(currentPage * ROWS_PER_PAGE, selectedList?.rowCount || 0)} of {selectedList?.rowCount.toLocaleString()} leads
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => loadLeadItems(selectedListId!, currentPage - 1)}
                            disabled={currentPage === 1 || loadingItems}
                            className="p-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <span className="text-sm text-zinc-400">
                            Page {currentPage} of {totalPages}
                          </span>
                          <button
                            onClick={() => loadLeadItems(selectedListId!, currentPage + 1)}
                            disabled={currentPage === totalPages || loadingItems}
                            className="p-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Tips Card */}
          <div className="mt-8 p-6 bg-zinc-900/50 rounded-xl border border-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-300 mb-2">💡 How to Use</h3>
            <ul className="text-sm text-zinc-500 space-y-1">
              <li>• <strong>Import</strong> - Click "+ New Lead List" then drag & drop an Excel file (.xlsx, .xls) or CSV file, or paste CSV data. First row should be headers.</li>
              <li>• <strong>Transform</strong> - Use AI to create new columns from existing data (e.g., summarize company descriptions into personalization hooks)</li>
              <li>• <strong>Push</strong> - Send your enriched leads directly to an Instantly campaign</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Create Lead List Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[90] flex items-center justify-center p-4">
          <div className="bg-[#1a1e24] rounded-2xl border border-zinc-700 w-full max-w-3xl max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-zinc-700">
              <div>
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <Upload className="w-5 h-5 text-[#d7ff00]" />
                  Create New Lead List
                </h2>
                <p className="text-sm text-zinc-400 mt-1">Upload Excel or CSV file, or paste CSV data</p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                disabled={isImporting}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="mb-4">
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  List Name
                </label>
                <input
                  type="text"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="e.g., Fitness Studios - January 2026"
                  className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-[#d7ff00] transition-colors"
                  disabled={isImporting}
                />
              </div>

              {/* File Upload Area */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  Upload Excel or CSV File
                </label>
                <div
                  onDrop={handleFileDrop}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                    isDragOver
                      ? 'border-[#d7ff00] bg-[#d7ff00]/10'
                      : 'border-zinc-700 bg-zinc-900/50 hover:border-zinc-600'
                  }`}
                >
                  {uploadedFile ? (
                    <div className="flex items-center justify-center gap-3">
                      <FileSpreadsheet className="w-8 h-8 text-[#d7ff00]" />
                      <div className="text-left">
                        <p className="text-white font-medium">{uploadedFile.name}</p>
                        <p className="text-xs text-zinc-400">
                          {(uploadedFile.size / 1024).toFixed(2)} KB
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setUploadedFile(null);
                          setCsvInput('');
                        }}
                        disabled={isImporting}
                        className="ml-auto p-2 hover:bg-zinc-800 rounded-lg transition-colors"
                      >
                        <X className="w-4 h-4 text-zinc-400" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-12 h-12 mx-auto mb-4 text-zinc-500" />
                      <p className="text-white mb-2">
                        Drag and drop an Excel or CSV file here
                      </p>
                      <p className="text-sm text-zinc-400 mb-4">or</p>
                      <label className="inline-block">
                        <input
                          type="file"
                          accept=".xlsx,.xls,.csv"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileSelect(file);
                          }}
                          disabled={isImporting}
                          className="hidden"
                        />
                        <span className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg cursor-pointer transition-colors">
                          <Upload className="w-4 h-4" />
                          Browse Files
                        </span>
                      </label>
                      <p className="text-xs text-zinc-500 mt-4">
                        Supports .xlsx, .xls, and .csv files
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* CSV Paste Option (Alternative) */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  Or Paste CSV Data
                </label>
                <textarea
                  value={csvInput}
                  onChange={(e) => {
                    setCsvInput(e.target.value);
                    if (e.target.value.trim()) setUploadedFile(null); // Clear file when pasting CSV
                  }}
                  placeholder={`Paste your CSV data here. First row should be column headers.\n\nExample:\nemail,first_name,company_name,company_description\njohn@example.com,John,Acme Fitness,"A boutique fitness studio focusing on HIIT and strength training"`}
                  className="w-full h-32 px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-[#d7ff00] transition-colors resize-none font-mono text-sm"
                  disabled={isImporting || !!uploadedFile}
                />
                <p className="text-xs text-zinc-500 mt-2">
                  Tip: Copy directly from Google Sheets - it will paste as CSV format
                </p>
              </div>

              {importProgress && (
                <div className="mb-4 p-4 bg-blue-900/20 border border-blue-800 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                    <div className="flex-1">
                      <p className="text-sm text-blue-400">
                        Importing leads... {importProgress.current.toLocaleString()} / {importProgress.total.toLocaleString()}
                      </p>
                      <div className="mt-2 h-2 bg-blue-900/50 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500 transition-all"
                          style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-zinc-700">
              <button
                onClick={() => setIsCreateModalOpen(false)}
                disabled={isImporting}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleImportCSV}
                disabled={isImporting || !newListName.trim() || (!uploadedFile && !csvInput.trim())}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isImporting || !newListName.trim() || (!uploadedFile && !csvInput.trim())
                    ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                    : 'bg-[#d7ff00] text-black hover:bg-[#c5eb00]'
                }`}
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Import {uploadedFile ? 'File' : 'CSV'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transform Column Modal */}
      {isTransformModalOpen && selectedList && (
        <div 
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[90] flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsTransformModalOpen(false);
              setSourceColumns([]);
              setNewColumnName('');
              setSelectedExistingColumn('');
              setColumnMode('new');
              setTransformPrompt('');
            }
          }}
        >
          <div className="bg-[#1a1e24] rounded-2xl border border-zinc-700 w-full max-w-lg overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-zinc-700">
              <div>
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <Wand2 className="w-5 h-5 text-purple-400" />
                  Transform Column with AI
                </h2>
                <p className="text-sm text-zinc-400 mt-1">Create a new column using AI</p>
              </div>
              <button
                onClick={() => {
                  setIsTransformModalOpen(false);
                  setSourceColumns([]);
                  setNewColumnName('');
                  setSelectedExistingColumn('');
                  setColumnMode('new');
                  setTransformPrompt('');
                }}
                disabled={isTransforming}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  Source Columns <span className="text-zinc-500">(Select one or more)</span>
                </label>
                <div className="max-h-48 overflow-y-auto bg-zinc-900 border border-zinc-700 rounded-xl p-4 space-y-2">
                  {selectedList.columns.length === 0 ? (
                    <p className="text-zinc-500 text-sm">No columns available</p>
                  ) : (
                    selectedList.columns.map((col) => (
                      <label
                        key={col}
                        className="flex items-center gap-3 p-2 hover:bg-zinc-800 rounded-lg cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={sourceColumns.includes(col)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSourceColumns([...sourceColumns, col]);
                            } else {
                              setSourceColumns(sourceColumns.filter(c => c !== col));
                            }
                          }}
                          disabled={isTransforming}
                          className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-purple-500 focus:ring-purple-500 focus:ring-offset-zinc-900"
                        />
                        <span className="text-white text-sm flex-1">{col}</span>
                      </label>
                    ))
                  )}
                </div>
                {sourceColumns.length > 0 && (
                  <p className="text-xs text-purple-400 mt-2">
                    {sourceColumns.length} column{sourceColumns.length !== 1 ? 's' : ''} selected: {sourceColumns.join(', ')}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  Transformation Prompt
                </label>
                <textarea
                  value={transformPrompt}
                  onChange={(e) => setTransformPrompt(e.target.value)}
                  placeholder={`Create a personalized email hook that will be inserted into this email template:\n\n"Hi {{firstName}},\nI came across {{companyName}} and liked what I saw. [PERSONALIZATION_HOOK HERE].\nI'm the founder of Pulse, a platform helping studios, gyms, and corporations, build and engage community..."\n\nRequirements:\n- Use the selected column data to create a specific, relevant hook\n- 8-15 words, conversational and natural\n- Should connect the company to community/engagement themes\n- Flow naturally after "I came across [company] and liked what I saw"\n- Highlight something unique or interesting about the company\n- No generic phrases - be specific to this company`}
                  className="w-full h-32 px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 transition-colors resize-none"
                  disabled={isTransforming}
                />
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-zinc-500">
                    The AI will have access to all selected columns. Reference them in your prompt (e.g., "using the company name and description columns...").
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setTransformPrompt(`Create a personalized email hook (8-15 words) that will be inserted into this outreach email:

"Hi {{firstName}},
I came across {{companyName}} and liked what I saw. [PERSONALIZATION_HOOK].
I'm the founder of Pulse, a platform helping studios, gyms, and corporations, build and engage community. Think what run club has done in real life, digitally."

Using the selected column data, write a hook that:
- Is specific and relevant to this company (use company name, description, industry, or other available data)
- Highlights something unique, interesting, or impressive about them
- Connects naturally to community, engagement, or growth themes (to bridge to Pulse's value prop)
- Sounds conversational and authentic - like a real person noticed something specific
- Flows naturally after "I came across [company] and liked what I saw"
- Avoids generic phrases like "impressive work" or "great company" - be specific

Example good hooks:
- "Your focus on building community through group classes really stands out."
- "The way you've grown your studio community is exactly what we help scale digitally."
- "Your approach to member engagement aligns perfectly with what we're building at Pulse."

Output ONLY the hook text, nothing else.`);
                    }}
                    className="text-xs text-purple-400 hover:text-purple-300 underline"
                    disabled={isTransforming}
                  >
                    Use suggested prompt for email personalization hooks
                  </button>
                </div>
              </div>

              {/* Token Estimation */}
              {tokenEstimate && selectedList && (
                <div className="p-4 bg-blue-900/20 border border-blue-800 rounded-xl">
                  <div className="flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-400 mb-2">Estimated Token Usage</p>
                      <div className="space-y-1 text-xs text-blue-300">
                        <div className="flex justify-between">
                          <span>Input tokens:</span>
                          <span className="font-mono">{tokenEstimate.inputTokens.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Output tokens (est.):</span>
                          <span className="font-mono">{tokenEstimate.outputTokens.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between pt-2 border-t border-blue-800/50">
                          <span className="font-medium">Estimated cost:</span>
                          <span className="font-mono font-semibold">
                            ${tokenEstimate.estimatedCost < 0.01 
                              ? '<0.01' 
                              : tokenEstimate.estimatedCost.toFixed(4)}
                          </span>
                        </div>
                        <p className="text-blue-400/70 mt-2 pt-2 border-t border-blue-800/50">
                          Based on {selectedList.rowCount.toLocaleString()} leads using gpt-4o-mini
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  Column Selection
                </label>
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setColumnMode('new');
                        setSelectedExistingColumn('');
                      }}
                      className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        columnMode === 'new'
                          ? 'bg-purple-600 text-white'
                          : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                      }`}
                      disabled={isTransforming}
                    >
                      Create New Column
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setColumnMode('existing');
                        setNewColumnName('');
                      }}
                      className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        columnMode === 'existing'
                          ? 'bg-purple-600 text-white'
                          : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                      }`}
                      disabled={isTransforming}
                    >
                      Update Existing Column
                    </button>
                  </div>

                  {columnMode === 'new' ? (
                    <div>
                      <input
                        type="text"
                        value={newColumnName}
                        onChange={(e) => setNewColumnName(e.target.value)}
                        placeholder="e.g., personalization_hook"
                        className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 transition-colors"
                        disabled={isTransforming}
                      />
                      <p className="text-xs text-zinc-500 mt-1">
                        Use snake_case for Instantly compatibility (e.g., personalization_hook)
                      </p>
                    </div>
                  ) : (
                    <div>
                      <select
                        value={selectedExistingColumn}
                        onChange={(e) => setSelectedExistingColumn(e.target.value)}
                        className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-purple-500 transition-colors"
                        disabled={isTransforming}
                      >
                        <option value="">Select column to update...</option>
                        {selectedList?.columns.map((col) => {
                          // Count how many leads have values in this column
                          const valueCount = allLeadItems.filter(item => {
                            const value = item.data[col];
                            return value !== undefined && value !== null && value !== '';
                          }).length;
                          const emptyCount = selectedList.rowCount - valueCount;
                          
                          return (
                            <option key={col} value={col}>
                              {col} ({valueCount.toLocaleString()} with values, {emptyCount.toLocaleString()} empty)
                            </option>
                          );
                        })}
                      </select>
                      <p className="text-xs text-zinc-500 mt-1">
                        Will only update leads that don't have values in this column
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {transformProgress && (
                <div className="p-4 bg-purple-900/20 border border-purple-800 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
                    <div className="flex-1">
                      <p className="text-sm text-purple-400">
                        Processing... {transformProgress.current.toLocaleString()} / {transformProgress.total.toLocaleString()}
                      </p>
                      <div className="mt-2 h-2 bg-purple-900/50 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-purple-500 transition-all"
                          style={{ width: `${(transformProgress.current / transformProgress.total) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-zinc-700">
              <button
                onClick={() => {
                  setIsTransformModalOpen(false);
                  setSourceColumns([]);
                  setNewColumnName('');
                  setSelectedExistingColumn('');
                  setColumnMode('new');
                  setTransformPrompt('');
                }}
                disabled={isTransforming}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleTransformColumn}
                disabled={isTransforming || sourceColumns.length === 0 || !transformPrompt.trim() || (columnMode === 'new' && !newColumnName.trim()) || (columnMode === 'existing' && !selectedExistingColumn)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isTransforming || sourceColumns.length === 0 || !transformPrompt.trim() || (columnMode === 'new' && !newColumnName.trim()) || (columnMode === 'existing' && !selectedExistingColumn)
                    ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                    : 'bg-purple-600 text-white hover:bg-purple-500'
                }`}
              >
                {isTransforming ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Transforming...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Transform Column
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Push to Instantly Modal */}
      {isPushModalOpen && selectedList && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[90] flex items-center justify-center p-4">
          <div className="bg-[#1a1e24] rounded-2xl border border-zinc-700 w-full max-w-lg max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-zinc-700">
              <div>
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <Send className="w-5 h-5 text-orange-400" />
                  Push to Instantly
                </h2>
                <p className="text-sm text-zinc-400 mt-1">Send {selectedList.rowCount.toLocaleString()} leads to a campaign</p>
              </div>
              <button
                onClick={() => setIsPushModalOpen(false)}
                disabled={isPushing}
                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[60vh] space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  Campaign ID <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={campaignId}
                  onChange={(e) => setCampaignId(e.target.value)}
                  placeholder="Paste your Instantly campaign ID"
                  className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500 transition-colors"
                  disabled={isPushing}
                />
                <p className="text-xs text-zinc-500 mt-1">
                  Find this in your Instantly campaign settings
                </p>
              </div>

              <div className="border-t border-zinc-700 pt-4">
                <h3 className="text-sm font-medium text-white mb-3">Column Mapping</h3>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">
                      Email Column <span className="text-red-400">*</span>
                    </label>
                    <select
                      value={emailColumn}
                      onChange={(e) => setEmailColumn(e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500"
                      disabled={isPushing}
                    >
                      <option value="">Select email column...</option>
                      {selectedList.columns.map((col) => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">First Name</label>
                      <select
                        value={firstNameColumn}
                        onChange={(e) => setFirstNameColumn(e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500"
                        disabled={isPushing}
                      >
                        <option value="">None</option>
                        {selectedList.columns.map((col) => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Last Name</label>
                      <select
                        value={lastNameColumn}
                        onChange={(e) => setLastNameColumn(e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500"
                        disabled={isPushing}
                      >
                        <option value="">None</option>
                        {selectedList.columns.map((col) => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Company Name</label>
                    <select
                      value={companyColumn}
                      onChange={(e) => setCompanyColumn(e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500"
                      disabled={isPushing}
                    >
                      <option value="">None</option>
                      {selectedList.columns.map((col) => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="border-t border-zinc-700 pt-4">
                <h3 className="text-sm font-medium text-white mb-2">Custom Variables</h3>
                <p className="text-xs text-zinc-500 mb-3">
                  Select columns to include as custom variables (use in emails as {"{{column_name}}"})
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedList.columns
                    .filter(col => col !== emailColumn && col !== firstNameColumn && col !== lastNameColumn && col !== companyColumn)
                    .map((col) => (
                      <button
                        key={col}
                        onClick={() => toggleCustomVariable(col)}
                        disabled={isPushing}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          customVariableColumns.includes(col)
                            ? 'bg-orange-600 text-white'
                            : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                        }`}
                      >
                        {col}
                      </button>
                    ))}
                </div>
                {customVariableColumns.length > 0 && (
                  <p className="text-xs text-orange-400 mt-2">
                    {customVariableColumns.length} custom variable(s) selected
                  </p>
                )}
              </div>

              {pushProgress && (
                <div className="p-4 bg-orange-900/20 border border-orange-800 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 animate-spin text-orange-400" />
                    <div className="flex-1">
                      <p className="text-sm text-orange-400">
                        Pushing leads... {pushProgress.current.toLocaleString()} / {pushProgress.total.toLocaleString()}
                      </p>
                      <p className="text-xs text-zinc-500 mt-1">
                        ✓ {pushProgress.success} successful • ✗ {pushProgress.failed} failed
                      </p>
                      <div className="mt-2 h-2 bg-orange-900/50 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-orange-500 transition-all"
                          style={{ width: `${(pushProgress.current / pushProgress.total) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-zinc-700">
              <button
                onClick={() => setIsPushModalOpen(false)}
                disabled={isPushing}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePushToInstantly}
                disabled={isPushing || !campaignId.trim() || !emailColumn}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isPushing || !campaignId.trim() || !emailColumn
                    ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                    : 'bg-orange-600 text-white hover:bg-orange-500'
                }`}
              >
                {isPushing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Pushing...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Push {selectedList.rowCount.toLocaleString()} Leads
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminRouteGuard>
  );
};

export default LeadMassagingAdmin;
