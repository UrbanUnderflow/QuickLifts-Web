import React, { useState, useEffect, useCallback, useRef } from 'react';
import Head from 'next/head';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import {
    collection,
    getDocs,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    query,
    orderBy,
    Timestamp,
    serverTimestamp
} from 'firebase/firestore';
import { db, storage } from '../../api/firebase/config';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
    FileText,
    Plus,
    Edit2,
    Trash2,
    Eye,
    Save,
    X,
    Loader2,
    CheckCircle,
    AlertCircle,
    Globe,
    Clock,
    ArrowLeft,
    Send,
    Image as ImageIcon,
    Upload,
    Bold,
    Italic,
    Quote,
    List,
    Heading1,
    Heading2,
    Link as LinkIcon,
    LayoutGrid,
    MessageSquareQuote,
    BarChart3,
    Sparkles,
    ChevronDown,
    ChevronUp,
    Zap,
    Trash
} from 'lucide-react';
import Link from 'next/link';

// ─── Types ─────────────────────────────────────────────────────────
interface ResearchArticle {
    id: string;
    slug: string;
    title: string;
    subtitle: string;
    author: string;
    category: string;
    excerpt: string;
    content: string;
    readTime: string;
    featured: boolean;
    featuredImage?: string;
    contentType?: 'article' | 'white-paper';
    status: 'draft' | 'published' | 'archived';
    createdAt: Timestamp;
    updatedAt: Timestamp;
    publishedAt?: Timestamp;
}

const CATEGORIES = [
    'Metabolic Health',
    'Performance Science',
    'Technology',
    'Wearables',
    'Nutrition',
    'Recovery',
];

// ─── Utility Functions ─────────────────────────────────────────────
const generateSlug = (title: string): string => {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
};

const calculateReadTime = (content: string): string => {
    const wordsPerMinute = 200;
    const words = content.trim().split(/\s+/).length;
    const minutes = Math.ceil(words / wordsPerMinute);
    return `${minutes} min read`;
};

const formatDate = (timestamp: Timestamp | undefined): string => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate();
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
};

// ─── Status Badge Component ────────────────────────────────────────
const StatusBadge: React.FC<{ status: ResearchArticle['status'] }> = ({ status }) => {
    const styles = {
        draft: 'bg-amber-50 text-amber-700 border-amber-200',
        published: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        archived: 'bg-stone-100 text-stone-500 border-stone-200',
    };

    return (
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${styles[status]}`}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
    );
};

// ─── Article List Item ─────────────────────────────────────────────
interface ArticleListItemProps {
    article: ResearchArticle;
    isSelected: boolean;
    onClick: () => void;
}

const ArticleListItem: React.FC<ArticleListItemProps> = ({ article, isSelected, onClick }) => (
    <li
        onClick={onClick}
        className={`p-4 rounded-xl cursor-pointer transition-all duration-200 border ${isSelected
            ? 'bg-white border-stone-300 shadow-md'
            : 'bg-stone-50 border-stone-100 hover:bg-white hover:border-stone-200 hover:shadow-sm'
            }`}
    >
        <div className="flex items-start justify-between gap-3 mb-2">
            <h3 className="font-medium text-stone-900 text-sm leading-snug line-clamp-2">
                {article.title}
            </h3>
            <StatusBadge status={article.status} />
        </div>
        <div className="flex items-center gap-2 text-xs text-stone-500">
            <span>{article.category}</span>
            <span>·</span>
            <span>{formatDate(article.createdAt)}</span>
        </div>
    </li>
);

// ─── Markdown Toolbar ──────────────────────────────────────────────
interface ToolbarProps {
    onAction: (action: string) => void;
}

const EditorToolbar: React.FC<ToolbarProps> = ({ onAction }) => {
    const basicButtons = [
        { icon: <Heading1 className="w-4 h-4" />, action: 'h1', title: 'Heading 1' },
        { icon: <Heading2 className="w-4 h-4" />, action: 'h2', title: 'Heading 2' },
        { icon: <Bold className="w-4 h-4" />, action: 'bold', title: 'Bold' },
        { icon: <Italic className="w-4 h-4" />, action: 'italic', title: 'Italic' },
        { icon: <Quote className="w-4 h-4" />, action: 'quote', title: 'Pull Quote' },
        { icon: <List className="w-4 h-4" />, action: 'list', title: 'Bullet List' },
        { icon: <LinkIcon className="w-4 h-4" />, action: 'link', title: 'Link' },
    ];

    const blockButtons = [
        { icon: <LayoutGrid className="w-4 h-4" />, action: 'blocks', title: 'Definition Blocks' },
        { icon: <MessageSquareQuote className="w-4 h-4" />, action: 'callout', title: 'Callout Box' },
        { icon: <BarChart3 className="w-4 h-4" />, action: 'stat', title: 'Stat Highlight' },
    ];

    return (
        <div className="flex items-center gap-1 p-2 bg-stone-100 border-b border-stone-200 rounded-t-lg">
            {basicButtons.map((btn) => (
                <button
                    key={btn.action}
                    onClick={() => onAction(btn.action)}
                    title={btn.title}
                    className="p-2 text-stone-500 hover:text-stone-900 hover:bg-stone-200 rounded transition-colors"
                >
                    {btn.icon}
                </button>
            ))}
            <div className="w-px h-6 bg-stone-300 mx-1" />
            {blockButtons.map((btn) => (
                <button
                    key={btn.action}
                    onClick={() => onAction(btn.action)}
                    title={btn.title}
                    className="p-2 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded transition-colors"
                >
                    {btn.icon}
                </button>
            ))}
        </div>
    );
};

// ─── Main Component ────────────────────────────────────────────────
const ResearchArticlesAdmin: React.FC = () => {
    const [articles, setArticles] = useState<ResearchArticle[]>([]);
    const [selectedArticle, setSelectedArticle] = useState<ResearchArticle | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        title: '',
        subtitle: '',
        author: 'Tremaine',
        category: CATEGORIES[0],
        excerpt: '',
        content: '',
        featuredImage: '',
        featured: false,
        contentType: 'article' as 'article' | 'white-paper',
    });

    // Visual enhancements state
    const [pullQuotes, setPullQuotes] = useState<{ text: string; afterParagraph: number }[]>([]);
    const [defBlocks, setDefBlocks] = useState<{ term: string; def: string }[]>([]);
    const [showEnhancements, setShowEnhancements] = useState(false);
    const [newQuoteText, setNewQuoteText] = useState('');
    const [newDefTerm, setNewDefTerm] = useState('');
    const [newDefText, setNewDefText] = useState('');
    const [autoSuggestions, setAutoSuggestions] = useState<{ type: string; text: string; context: string }[]>([]);

    // Image upload state
    const [uploadingImage, setUploadingImage] = useState(false);

    // Author profiles
    const [authorProfiles, setAuthorProfiles] = useState<{ id: string; name: string; title: string }[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            showMessage('error', 'Please select an image file');
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            showMessage('error', 'Image must be under 5MB');
            return;
        }

        setUploadingImage(true);
        try {
            const fileName = `research-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
            const storageRef = ref(storage, `research/${fileName}`);
            await uploadBytes(storageRef, file, {
                contentType: file.type,
            });
            const downloadURL = await getDownloadURL(storageRef);
            setFormData(prev => ({ ...prev, featuredImage: downloadURL }));
            showMessage('success', 'Image uploaded!');
        } catch (error) {
            console.error('Error uploading image:', error);
            showMessage('error', 'Failed to upload image');
        } finally {
            setUploadingImage(false);
            // Reset file input so same file can be re-selected
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // ─── Load Articles ─────────────────────────────────────────────
    const loadArticles = useCallback(async () => {
        setLoading(true);
        try {
            const articlesQuery = query(
                collection(db, 'researchArticles'),
                orderBy('createdAt', 'desc')
            );
            const snapshot = await getDocs(articlesQuery);
            const articlesData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as ResearchArticle[];
            setArticles(articlesData);
        } catch (error) {
            console.error('Error loading articles:', error);
            showMessage('error', 'Failed to load articles');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadArticles();
    }, [loadArticles]);

    // Load author profiles for dropdown
    useEffect(() => {
        const loadAuthors = async () => {
            try {
                const snapshot = await getDocs(collection(db, 'authorProfiles'));
                const profiles = snapshot.docs.map(d => ({
                    id: d.id,
                    name: d.data().name || d.id,
                    title: d.data().title || '',
                }));
                setAuthorProfiles(profiles);
            } catch (e) {
                console.error('Error loading author profiles:', e);
            }
        };
        loadAuthors();
    }, []);

    // ─── Message Handler ───────────────────────────────────────────
    const showMessage = (type: 'success' | 'error', text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 4000);
    };

    // ─── Form Handlers ─────────────────────────────────────────────
    const resetForm = () => {
        setFormData({
            title: '',
            subtitle: '',
            author: 'Tremaine',
            category: CATEGORIES[0],
            excerpt: '',
            content: '',
            featuredImage: '',
            featured: false,
            contentType: 'article' as 'article' | 'white-paper',
        });
    };

    const handleNewArticle = () => {
        resetForm();
        setSelectedArticle(null);
        setIsCreating(true);
        setIsEditing(true);
    };

    const handleEdit = (article: ResearchArticle) => {
        setFormData({
            title: article.title,
            subtitle: article.subtitle,
            author: article.author,
            category: article.category,
            excerpt: article.excerpt,
            content: article.content,
            featuredImage: article.featuredImage || '',
            featured: article.featured,
            contentType: (article.contentType || 'article') as 'article' | 'white-paper',
        });
        setSelectedArticle(article);
        setIsEditing(true);
        setIsCreating(false);
    };

    const handleCancel = () => {
        setIsEditing(false);
        setIsCreating(false);
        if (selectedArticle) {
            // Reset to original article data
            setFormData({
                title: selectedArticle.title,
                subtitle: selectedArticle.subtitle,
                author: selectedArticle.author,
                category: selectedArticle.category,
                excerpt: selectedArticle.excerpt,
                content: selectedArticle.content,
                featuredImage: selectedArticle.featuredImage || '',
                featured: selectedArticle.featured,
                contentType: (selectedArticle.contentType || 'article') as 'article' | 'white-paper',
            });
        } else {
            resetForm();
        }
    };

    // ─── Save Article ──────────────────────────────────────────────
    const handleSave = async (publish: boolean = false) => {
        if (!formData.title.trim()) {
            showMessage('error', 'Title is required');
            return;
        }

        setSaving(true);
        try {
            const slug = generateSlug(formData.title);
            const readTime = calculateReadTime(formData.content);
            const now = Timestamp.now();

            if (isCreating) {
                // Create new article
                const newArticle: Omit<ResearchArticle, 'id'> = {
                    slug,
                    title: formData.title,
                    subtitle: formData.subtitle,
                    author: formData.author,
                    category: formData.category,
                    excerpt: formData.excerpt,
                    content: formData.content,
                    readTime,
                    featured: formData.featured,
                    featuredImage: formData.featuredImage,
                    contentType: formData.contentType,
                    status: publish ? 'published' : 'draft',
                    createdAt: now,
                    updatedAt: now,
                    ...(publish ? { publishedAt: now } : {}),
                };

                await setDoc(doc(db, 'researchArticles', slug), newArticle);
                showMessage('success', publish ? 'Article published!' : 'Draft saved!');
            } else if (selectedArticle) {
                // Update existing article
                const updates: Partial<ResearchArticle> = {
                    title: formData.title,
                    subtitle: formData.subtitle,
                    author: formData.author,
                    category: formData.category,
                    excerpt: formData.excerpt,
                    content: formData.content,
                    readTime,
                    featured: formData.featured,
                    featuredImage: formData.featuredImage,
                    contentType: formData.contentType,
                    updatedAt: now,
                    ...(publish && selectedArticle.status !== 'published'
                        ? { status: 'published', publishedAt: now }
                        : {}
                    ),
                };

                await updateDoc(doc(db, 'researchArticles', selectedArticle.id), updates);
                showMessage('success', publish ? 'Article published!' : 'Changes saved!');
            }

            await loadArticles();
            setIsEditing(false);
            setIsCreating(false);
        } catch (error) {
            console.error('Error saving article:', error);
            showMessage('error', 'Failed to save article');
        } finally {
            setSaving(false);
        }
    };

    // ─── Delete Article ────────────────────────────────────────────
    const handleDelete = async (articleId: string) => {
        if (!confirm('Are you sure you want to delete this article? This action cannot be undone.')) {
            return;
        }

        try {
            await deleteDoc(doc(db, 'researchArticles', articleId));
            showMessage('success', 'Article deleted');
            setSelectedArticle(null);
            setIsEditing(false);
            await loadArticles();
        } catch (error) {
            console.error('Error deleting article:', error);
            showMessage('error', 'Failed to delete article');
        }
    };

    // ─── Publish/Unpublish ─────────────────────────────────────────
    const handlePublish = async (articleId: string) => {
        try {
            await updateDoc(doc(db, 'researchArticles', articleId), {
                status: 'published',
                publishedAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            });
            showMessage('success', 'Article published!');
            await loadArticles();
        } catch (error) {
            console.error('Error publishing:', error);
            showMessage('error', 'Failed to publish');
        }
    };

    const handleUnpublish = async (articleId: string) => {
        try {
            await updateDoc(doc(db, 'researchArticles', articleId), {
                status: 'draft',
                updatedAt: Timestamp.now(),
            });
            showMessage('success', 'Article unpublished');
            await loadArticles();
        } catch (error) {
            console.error('Error unpublishing:', error);
            showMessage('error', 'Failed to unpublish');
        }
    };

    // ─── Toolbar Actions ───────────────────────────────────────────
    const handleToolbarAction = (action: string) => {
        const textarea = document.getElementById('content-editor') as HTMLTextAreaElement;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = formData.content;
        const selectedText = text.substring(start, end);

        let newText = '';
        let cursorOffset = 0;

        switch (action) {
            case 'h1':
                newText = text.substring(0, start) + `# ${selectedText}` + text.substring(end);
                cursorOffset = 2;
                break;
            case 'h2':
                newText = text.substring(0, start) + `## ${selectedText}` + text.substring(end);
                cursorOffset = 3;
                break;
            case 'bold':
                newText = text.substring(0, start) + `**${selectedText}**` + text.substring(end);
                cursorOffset = 2;
                break;
            case 'italic':
                newText = text.substring(0, start) + `*${selectedText}*` + text.substring(end);
                cursorOffset = 1;
                break;
            case 'quote':
                newText = text.substring(0, start) + `> ${selectedText}` + text.substring(end);
                cursorOffset = 2;
                break;
            case 'list':
                newText = text.substring(0, start) + `- ${selectedText}` + text.substring(end);
                cursorOffset = 2;
                break;
            case 'link':
                newText = text.substring(0, start) + `[${selectedText}](url)` + text.substring(end);
                cursorOffset = 1;
                break;
            case 'blocks': {
                const blockSnippet = `\n\n:::blocks\nTerm 1: Definition goes here\nTerm 2: Definition goes here\n:::\n\n`;
                newText = text.substring(0, start) + blockSnippet + text.substring(end);
                cursorOffset = blockSnippet.indexOf('Term 1');
                break;
            }
            case 'callout': {
                const calloutSnippet = `\n\n:::callout\n${selectedText || 'Your callout text here'}\n:::\n\n`;
                newText = text.substring(0, start) + calloutSnippet + text.substring(end);
                cursorOffset = calloutSnippet.indexOf(selectedText || 'Your');
                break;
            }
            case 'stat': {
                const statSnippet = `\n\n:::stat\n85%\nOf users experienced this result\n:::\n\n`;
                newText = text.substring(0, start) + statSnippet + text.substring(end);
                cursorOffset = statSnippet.indexOf('85%');
                break;
            }
            default:
                return;
        }

        setFormData({ ...formData, content: newText });

        // Restore focus after state update
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + cursorOffset, end + cursorOffset);
        }, 0);
    };

    // ─── Format as White Paper ─────────────────────────────────────
    const handleFormatAsWhitePaper = () => {
        const raw = formData.content;
        if (!raw.trim()) {
            showMessage('error', 'No content to format.');
            return;
        }

        const lines = raw.split('\n');
        const output: string[] = [];
        let inAbstract = false;
        let inReferences = false;
        let abstractLines: string[] = [];
        let referencesLines: string[] = [];
        let i = 0;

        while (i < lines.length) {
            const line = lines[i];
            const trimmed = line.trim();

            // Detect "Abstract" standalone heading
            if (/^abstract$/i.test(trimmed)) {
                inAbstract = true;
                abstractLines = [];
                i++;
                continue;
            }

            // Detect References standalone heading
            if (/^references$/i.test(trimmed)) {
                if (inAbstract) {
                    output.push(':::abstract');
                    output.push(abstractLines.join('\n').trim());
                    output.push(':::');
                    output.push('');
                    inAbstract = false;
                }
                inReferences = true;
                referencesLines = [];
                i++;
                continue;
            }

            // Detect top-level numbered sections: "1. Title" or "1 Title"
            const sectionMatch = trimmed.match(/^(\d+)\.?\s+(.+)$/);
            // Detect sub-sections: "2.1 Title" or "2.1. Title"
            const subsectionMatch = trimmed.match(/^(\d+\.\d+)\.?\s+(.+)$/);

            if (inAbstract) {
                // If we hit a numbered section, close abstract
                if (sectionMatch || subsectionMatch) {
                    output.push(':::abstract');
                    output.push(abstractLines.join('\n').trim());
                    output.push(':::');
                    output.push('');
                    inAbstract = false;
                    // Don't increment i — reprocess current line
                    continue;
                }
                abstractLines.push(trimmed);
                i++;
                continue;
            }

            if (inReferences) {
                referencesLines.push(trimmed);
                i++;
                continue;
            }

            // Sub-section heading (check before section since it's more specific)
            if (subsectionMatch) {
                output.push('');
                output.push(`## ${subsectionMatch[1]} ${subsectionMatch[2]}`);
                output.push(''); // blank line after so body text is a separate paragraph
                i++;
                continue;
            }

            // Top-level section heading
            if (sectionMatch) {
                output.push('');
                output.push(`# ${sectionMatch[1]}. ${sectionMatch[2]}`);
                output.push(''); // blank line after so body text is a separate paragraph
                i++;
                continue;
            }

            // Regular line
            output.push(trimmed);
            i++;
        }

        // Close references
        if (inReferences && referencesLines.length > 0) {
            output.push('');
            output.push(':::references');
            output.push(referencesLines.filter(l => l).join('\n'));
            output.push(':::');
        }

        // Collapse multiple blank lines
        const collapsed: string[] = [];
        let prevBlank = false;
        for (const l of output) {
            const isBlank = l.trim() === '';
            if (isBlank && prevBlank) continue;
            collapsed.push(l);
            prevBlank = isBlank;
        }

        setFormData(prev => ({
            ...prev,
            content: collapsed.join('\n'),
            contentType: 'white-paper',
        }));
        showMessage('success', 'Content formatted as White Paper!');
    };

    // ─── Auto-Enhance: scan content for visual opportunities ────────
    const handleAutoEnhance = () => {
        const content = formData.content;
        const suggestions: { type: string; text: string; context: string }[] = [];
        const paragraphs = content.split('\n\n').filter(p => p.trim());

        paragraphs.forEach((para, idx) => {
            // Skip existing blocks, headers, quotes
            if (para.startsWith('#') || para.startsWith('>') || para.startsWith(':::') || para.startsWith('-')) return;

            // Detect potential stat sentences (numbers/percentages)
            const statMatch = para.match(/(\d+[%+]?\s*(?:percent|of|times|faster|slower|more|less|increase|decrease|people|users))/i);
            if (statMatch) {
                suggestions.push({
                    type: 'stat',
                    text: statMatch[1],
                    context: para.substring(0, 80) + '...'
                });
            }

            // Detect short punchy sentences that could be pull quotes (under 120 chars, strong language)
            if (para.length < 120 && para.length > 30 && !para.includes('\n')) {
                const punchWords = ['not', 'never', 'always', 'every', 'everything', 'nothing', 'only', 'most', 'real', 'truth', 'key', 'critical', 'important', 'essential'];
                const hasImpact = punchWords.some(w => para.toLowerCase().includes(w));
                if (hasImpact) {
                    suggestions.push({
                        type: 'quote',
                        text: para,
                        context: `Paragraph ${idx + 1}`
                    });
                }
            }

            // Detect definition-like patterns ("X is Y" or "X: Y" at start)
            const defMatch = para.match(/^([A-Z][a-z]+(?:\s[A-Z]?[a-z]+)?)\s+(?:is|are|means|refers to)\s+/i);
            if (defMatch) {
                suggestions.push({
                    type: 'definition',
                    text: defMatch[1],
                    context: para.substring(0, 80) + '...'
                });
            }

            // Detect comparison/contrast patterns ("Unlike X, Y")
            if (para.match(/^(Unlike|While|Whereas|Instead of|Rather than|Compared to)/i) && para.length < 150) {
                suggestions.push({
                    type: 'callout',
                    text: para,
                    context: `Paragraph ${idx + 1}`
                });
            }
        });

        setAutoSuggestions(suggestions);
        if (suggestions.length === 0) {
            showMessage('success', 'Content looks great! No additional visual enhancements detected.');
        } else {
            showMessage('success', `Found ${suggestions.length} enhancement opportunities!`);
        }
    };

    // Apply a suggestion to the content
    const applySuggestion = (suggestion: { type: string; text: string; context: string }) => {
        let newContent = formData.content;

        switch (suggestion.type) {
            case 'quote': {
                // Wrap the matching text as a blockquote
                newContent = newContent.replace(suggestion.text, `> ${suggestion.text}`);
                break;
            }
            case 'callout': {
                newContent = newContent.replace(suggestion.text, `:::callout\n${suggestion.text}\n:::`);
                break;
            }
            case 'stat': {
                // Find the paragraph containing this stat and add a stat block after it
                const paras = newContent.split('\n\n');
                const matchIdx = paras.findIndex(p => p.includes(suggestion.text));
                if (matchIdx >= 0) {
                    const numMatch = suggestion.text.match(/(\d+[%+]?)/);
                    const statVal = numMatch ? numMatch[1] : suggestion.text;
                    const label = suggestion.text.replace(statVal, '').trim();
                    paras.splice(matchIdx + 1, 0, `:::stat\n${statVal}\n${label || 'Key metric from this section'}\n:::`);
                    newContent = paras.join('\n\n');
                }
                break;
            }
            case 'definition': {
                // Add to the defBlocks list for the user to manage
                const para = formData.content.split('\n\n').find(p => p.includes(suggestion.text));
                if (para) {
                    const colonIdx = para.indexOf(' is ');
                    const def = colonIdx > -1 ? para.substring(colonIdx + 4).replace(/\.$/, '') : '';
                    setDefBlocks(prev => [...prev, { term: suggestion.text, def: def.substring(0, 120) }]);
                }
                break;
            }
        }

        setFormData(prev => ({ ...prev, content: newContent }));
        setAutoSuggestions(prev => prev.filter(s => s !== suggestion));
        showMessage('success', `Applied ${suggestion.type} enhancement!`);
    };

    // Build definition blocks markdown and inject at cursor or end
    const injectDefBlocks = () => {
        if (defBlocks.length === 0) return;
        const blockMd = '\n\n:::blocks\n' + defBlocks.map(d => `${d.term}: ${d.def}`).join('\n') + '\n:::\n\n';
        const textarea = document.getElementById('content-editor') as HTMLTextAreaElement;
        const pos = textarea ? textarea.selectionStart : formData.content.length;
        const text = formData.content;
        setFormData(prev => ({
            ...prev,
            content: text.substring(0, pos) + blockMd + text.substring(pos)
        }));
        setDefBlocks([]);
        showMessage('success', 'Definition blocks injected into content!');
    };

    // Build pull quotes and inject into content
    const injectPullQuotes = () => {
        if (pullQuotes.length === 0) return;
        let text = formData.content;
        // Insert quotes as blockquotes at the end of the content
        const quotesMd = pullQuotes.map(q => `\n\n> ${q.text}`).join('');
        text += quotesMd;
        setFormData(prev => ({ ...prev, content: text }));
        setPullQuotes([]);
        showMessage('success', 'Pull quotes added to content!');
    };

    // ─── Render ────────────────────────────────────────────────────
    return (
        <AdminRouteGuard>
            <Head>
                <title>Research Articles | Pulse Admin</title>
            </Head>

            <div className="min-h-screen bg-[#FAFAF7]">
                {/* Header */}
                <header className="bg-white border-b border-stone-200 sticky top-0 z-50">
                    <div className="max-w-7xl mx-auto px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <Link href="/admin" className="text-stone-400 hover:text-stone-600 transition-colors">
                                    <ArrowLeft className="w-5 h-5" />
                                </Link>
                                <div>
                                    <h1 className="text-xl font-bold text-stone-900">Research Articles</h1>
                                    <p className="text-sm text-stone-500">Manage your research publications</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <Link
                                    href="/admin/authorProfiles"
                                    className="flex items-center gap-2 px-4 py-2.5 bg-white text-stone-700 border border-stone-300 rounded-lg hover:bg-stone-50 transition-colors font-medium text-sm"
                                >
                                    <Edit2 className="w-4 h-4" />
                                    Author Profiles
                                </Link>
                                <button
                                    onClick={handleNewArticle}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-stone-900 text-white rounded-lg hover:bg-stone-800 transition-colors font-medium text-sm"
                                >
                                    <Plus className="w-4 h-4" />
                                    New Article
                                </button>
                            </div>
                        </div>
                    </div>
                </header>

                <div className="max-w-7xl mx-auto px-6 py-8">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                        {/* ─── Article List ─────────────────────────────── */}
                        <div className="lg:col-span-4">
                            <div className="bg-white rounded-2xl p-5 shadow-sm border border-stone-200">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-stone-900 font-semibold">All Articles</h2>
                                    <span className="text-xs text-stone-400">{articles.length} total</span>
                                </div>

                                {loading ? (
                                    <div className="flex justify-center py-12">
                                        <Loader2 className="w-6 h-6 text-stone-400 animate-spin" />
                                    </div>
                                ) : articles.length === 0 ? (
                                    <div className="text-center py-12">
                                        <FileText className="w-10 h-10 text-stone-300 mx-auto mb-3" />
                                        <p className="text-stone-500 text-sm">No articles yet</p>
                                        <button
                                            onClick={handleNewArticle}
                                            className="mt-3 text-sm text-stone-600 hover:text-stone-900 transition-colors"
                                        >
                                            Create your first article →
                                        </button>
                                    </div>
                                ) : (
                                    <ul className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
                                        {articles.map((article) => (
                                            <ArticleListItem
                                                key={article.id}
                                                article={article}
                                                isSelected={selectedArticle?.id === article.id && !isCreating}
                                                onClick={() => {
                                                    setSelectedArticle(article);
                                                    setIsCreating(false);
                                                    setIsEditing(false);
                                                    setFormData({
                                                        title: article.title,
                                                        subtitle: article.subtitle,
                                                        author: article.author,
                                                        category: article.category,
                                                        excerpt: article.excerpt,
                                                        content: article.content,
                                                        featuredImage: article.featuredImage || '',
                                                        featured: article.featured,
                                                        contentType: (article.contentType || 'article') as 'article' | 'white-paper',
                                                    });
                                                }}
                                            />
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>

                        {/* ─── Editor / Preview Panel ───────────────────── */}
                        <div className="lg:col-span-8">
                            {isEditing || isCreating ? (
                                // ─── EDIT MODE ─────────────────────────────────
                                <div className="bg-white rounded-2xl shadow-lg border border-stone-200 overflow-hidden">
                                    {/* Editor Header */}
                                    <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
                                        <h2 className="font-semibold text-stone-900">
                                            {isCreating ? 'New Article' : 'Edit Article'}
                                        </h2>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={handleCancel}
                                                className="px-4 py-2 text-stone-600 hover:text-stone-900 text-sm font-medium transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={() => handleSave(false)}
                                                disabled={saving}
                                                className="flex items-center gap-2 px-4 py-2 bg-stone-200 text-stone-800 rounded-lg hover:bg-stone-300 transition-colors text-sm font-medium disabled:opacity-50"
                                            >
                                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                                Save Draft
                                            </button>
                                            <button
                                                onClick={() => handleSave(true)}
                                                disabled={saving}
                                                className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-white rounded-lg hover:bg-stone-800 transition-colors text-sm font-medium disabled:opacity-50"
                                            >
                                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                                {selectedArticle?.status === 'published' ? 'Update' : 'Publish'}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Editor Form */}
                                    <div className="p-6 space-y-6">
                                        {/* Title */}
                                        <div>
                                            <input
                                                type="text"
                                                value={formData.title}
                                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                                placeholder="Article title..."
                                                className="w-full text-3xl font-bold text-stone-900 placeholder:text-stone-300 border-0 focus:outline-none focus:ring-0 bg-transparent"
                                            />
                                        </div>

                                        {/* Subtitle */}
                                        <div>
                                            <input
                                                type="text"
                                                value={formData.subtitle}
                                                onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                                                placeholder="Subtitle (appears above the title)..."
                                                className="w-full text-lg text-stone-600 placeholder:text-stone-300 border-0 focus:outline-none focus:ring-0 bg-transparent"
                                            />
                                        </div>

                                        {/* Meta Row */}
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <div>
                                                <label className="block text-xs font-medium text-stone-500 mb-1.5">Author</label>
                                                <select
                                                    value={formData.author}
                                                    onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                                                    className="w-full px-3 py-2 rounded-lg border border-stone-200 text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-400 bg-white"
                                                >
                                                    {authorProfiles.length > 0 ? (
                                                        authorProfiles.map((author) => (
                                                            <option key={author.id} value={author.name}>
                                                                {author.name}{author.title ? ` — ${author.title}` : ''}
                                                            </option>
                                                        ))
                                                    ) : (
                                                        <option value={formData.author}>{formData.author}</option>
                                                    )}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-stone-500 mb-1.5">Category</label>
                                                <select
                                                    value={formData.category}
                                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                                    className="w-full px-3 py-2 rounded-lg border border-stone-200 text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-400 bg-white"
                                                >
                                                    {CATEGORIES.map((cat) => (
                                                        <option key={cat} value={cat}>{cat}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-stone-500 mb-1.5">Content Type</label>
                                                <select
                                                    value={formData.contentType}
                                                    onChange={(e) => setFormData({ ...formData, contentType: e.target.value as 'article' | 'white-paper' })}
                                                    className="w-full px-3 py-2 rounded-lg border border-stone-200 text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-400 bg-white"
                                                >
                                                    <option value="article">Article</option>
                                                    <option value="white-paper">White Paper</option>
                                                </select>
                                            </div>
                                            <div className="col-span-2 md:col-span-1">
                                                <label className="block text-xs font-medium text-stone-500 mb-1.5">Featured Image</label>
                                                <div className="space-y-2">
                                                    {/* Upload button */}
                                                    <input
                                                        ref={fileInputRef}
                                                        type="file"
                                                        accept="image/*"
                                                        onChange={handleImageUpload}
                                                        className="hidden"
                                                        id="featured-image-upload"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => fileInputRef.current?.click()}
                                                        disabled={uploadingImage}
                                                        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dashed border-stone-300 text-stone-500 text-sm hover:border-stone-400 hover:text-stone-700 hover:bg-stone-50 transition-all disabled:opacity-50"
                                                    >
                                                        {uploadingImage ? (
                                                            <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
                                                        ) : (
                                                            <><Upload className="w-4 h-4" /> Upload Image</>
                                                        )}
                                                    </button>
                                                    {/* URL fallback input */}
                                                    <input
                                                        type="text"
                                                        value={formData.featuredImage}
                                                        onChange={(e) => setFormData({ ...formData, featuredImage: e.target.value })}
                                                        placeholder="Or paste image URL..."
                                                        className="w-full px-3 py-2 rounded-lg border border-stone-200 text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-400"
                                                    />
                                                    {/* Preview thumbnail */}
                                                    {formData.featuredImage && (
                                                        <div className="relative w-full h-24 rounded-lg overflow-hidden bg-stone-100 border border-stone-200">
                                                            <img
                                                                src={formData.featuredImage}
                                                                alt="Preview"
                                                                className="w-full h-full object-cover"
                                                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => setFormData({ ...formData, featuredImage: '' })}
                                                                className="absolute top-1 right-1 p-1 bg-white/80 rounded-full hover:bg-white transition-colors"
                                                                title="Remove image"
                                                            >
                                                                <X className="w-3 h-3 text-stone-600" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-end">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.featured}
                                                        onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                                                        className="w-4 h-4 rounded border-stone-300 text-stone-900 focus:ring-stone-900"
                                                    />
                                                    <span className="text-sm text-stone-700">Featured article</span>
                                                </label>
                                            </div>
                                        </div>

                                        {/* Excerpt */}
                                        <div>
                                            <label className="block text-xs font-medium text-stone-500 mb-1.5">Excerpt</label>
                                            <textarea
                                                value={formData.excerpt}
                                                onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
                                                placeholder="A brief summary that appears in article listings..."
                                                rows={2}
                                                className="w-full px-4 py-3 rounded-lg border border-stone-200 text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-400 resize-none"
                                            />
                                        </div>

                                        {/* Content Editor */}
                                        <div>
                                            <div className="flex items-center justify-between mb-1.5">
                                                <label className="block text-xs font-medium text-stone-500">Content</label>
                                                {formData.contentType === 'white-paper' && (
                                                    <button
                                                        type="button"
                                                        onClick={handleFormatAsWhitePaper}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
                                                    >
                                                        <Sparkles className="w-3 h-3" />
                                                        Format as White Paper
                                                    </button>
                                                )}
                                            </div>
                                            <div className="border border-stone-200 rounded-lg overflow-hidden">
                                                <EditorToolbar onAction={handleToolbarAction} />
                                                <textarea
                                                    id="content-editor"
                                                    value={formData.content}
                                                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                                    placeholder={formData.contentType === 'white-paper'
                                                        ? 'Paste your white paper text here, then click "Format as White Paper" to auto-structure it...'
                                                        : 'Write your article content here... Use Markdown for formatting.'}
                                                    rows={20}
                                                    className="w-full px-4 py-4 text-stone-900 text-base leading-relaxed focus:outline-none resize-none bg-white font-mono text-sm"
                                                    style={{ fontFamily: "'SF Mono', 'Monaco', 'Menlo', monospace" }}
                                                />
                                            </div>
                                            <p className="mt-2 text-xs text-stone-400">
                                                {formData.contentType === 'white-paper'
                                                    ? 'Paste raw white paper text and click "Format as White Paper" to auto-detect Abstract, numbered sections, sub-sections, and References.'
                                                    : 'Supports Markdown. Use toolbar for headers, quotes, lists, and visual blocks (amber icons).'}
                                            </p>
                                        </div>

                                        {/* ─── Visual Enhancements Panel ─────────────── */}
                                        <div className="border border-stone-200 rounded-xl overflow-hidden">
                                            <button
                                                type="button"
                                                onClick={() => setShowEnhancements(!showEnhancements)}
                                                className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-amber-50 to-stone-50 hover:from-amber-100/60 hover:to-stone-100/60 transition-colors"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <Sparkles className="w-4 h-4 text-amber-500" />
                                                    <span className="text-sm font-semibold text-stone-800">Visual Enhancements</span>
                                                    <span className="text-xs text-stone-400">Pull Quotes · Definition Blocks · Auto-Enhance</span>
                                                </div>
                                                {showEnhancements ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
                                            </button>

                                            {showEnhancements && (
                                                <div className="p-4 space-y-6 bg-white border-t border-stone-200">
                                                    {/* Auto-Enhance */}
                                                    <div>
                                                        <button
                                                            type="button"
                                                            onClick={handleAutoEnhance}
                                                            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-medium hover:from-amber-600 hover:to-orange-600 transition-all shadow-sm"
                                                        >
                                                            <Zap className="w-4 h-4" />
                                                            Auto-Enhance Content
                                                        </button>
                                                        <p className="mt-1.5 text-xs text-stone-400">Scans your article for stats, punchy quotes, definitions, and contrasts that could be enhanced visually.</p>

                                                        {/* Auto suggestions */}
                                                        {autoSuggestions.length > 0 && (
                                                            <div className="mt-3 space-y-2">
                                                                <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Suggestions ({autoSuggestions.length})</p>
                                                                {autoSuggestions.map((s, i) => (
                                                                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200/60">
                                                                        <div className="flex-shrink-0 mt-0.5">
                                                                            {s.type === 'quote' && <Quote className="w-4 h-4 text-amber-600" />}
                                                                            {s.type === 'callout' && <MessageSquareQuote className="w-4 h-4 text-amber-600" />}
                                                                            {s.type === 'stat' && <BarChart3 className="w-4 h-4 text-amber-600" />}
                                                                            {s.type === 'definition' && <LayoutGrid className="w-4 h-4 text-amber-600" />}
                                                                        </div>
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className="text-xs font-medium text-amber-800 uppercase">{s.type}</p>
                                                                            <p className="text-sm text-stone-700 truncate">{s.text}</p>
                                                                            <p className="text-xs text-stone-400 mt-0.5">{s.context}</p>
                                                                        </div>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => applySuggestion(s)}
                                                                            className="flex-shrink-0 px-3 py-1.5 rounded-md bg-amber-500 text-white text-xs font-medium hover:bg-amber-600 transition-colors"
                                                                        >
                                                                            Apply
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Pull Quotes */}
                                                    <div>
                                                        <p className="text-xs font-semibold text-stone-600 uppercase tracking-wider mb-2">Pull Quotes</p>
                                                        <p className="text-xs text-stone-400 mb-3">Add standout sentences to render as styled blockquotes with a green accent bar.</p>
                                                        <div className="space-y-2 mb-3">
                                                            {pullQuotes.map((q, i) => (
                                                                <div key={i} className="flex items-start gap-2 p-3 rounded-lg bg-stone-50 border border-stone-200">
                                                                    <div className="w-1 self-stretch rounded-full bg-[#E0FE10] flex-shrink-0" />
                                                                    <p className="text-sm text-stone-600 italic flex-1">{q.text}</p>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setPullQuotes(prev => prev.filter((_, idx) => idx !== i))}
                                                                        className="p-1 text-stone-400 hover:text-red-500 transition-colors flex-shrink-0"
                                                                    >
                                                                        <Trash className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <input
                                                                type="text"
                                                                value={newQuoteText}
                                                                onChange={(e) => setNewQuoteText(e.target.value)}
                                                                placeholder="Type a pull quote..."
                                                                className="flex-1 px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter' && newQuoteText.trim()) {
                                                                        setPullQuotes(prev => [...prev, { text: newQuoteText.trim(), afterParagraph: 0 }]);
                                                                        setNewQuoteText('');
                                                                    }
                                                                }}
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    if (newQuoteText.trim()) {
                                                                        setPullQuotes(prev => [...prev, { text: newQuoteText.trim(), afterParagraph: 0 }]);
                                                                        setNewQuoteText('');
                                                                    }
                                                                }}
                                                                className="px-3 py-2 rounded-lg bg-stone-900 text-white text-sm hover:bg-stone-800 transition-colors"
                                                            >
                                                                <Plus className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                        {pullQuotes.length > 0 && (
                                                            <button
                                                                type="button"
                                                                onClick={injectPullQuotes}
                                                                className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-600 hover:text-amber-700 transition-colors"
                                                            >
                                                                <Zap className="w-3 h-3" /> Inject {pullQuotes.length} quote{pullQuotes.length > 1 ? 's' : ''} into content
                                                            </button>
                                                        )}
                                                    </div>

                                                    {/* Definition Blocks */}
                                                    <div>
                                                        <p className="text-xs font-semibold text-stone-600 uppercase tracking-wider mb-2">Definition Blocks</p>
                                                        <p className="text-xs text-stone-400 mb-3">Build a grid of term/definition cards. These render as a 2-column card grid in the article.</p>
                                                        <div className="space-y-2 mb-3">
                                                            {defBlocks.map((d, i) => (
                                                                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-stone-50 border border-stone-200">
                                                                    <div className="flex-1">
                                                                        <p className="text-sm font-bold text-stone-900">{d.term}</p>
                                                                        <p className="text-xs text-stone-500">{d.def}</p>
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setDefBlocks(prev => prev.filter((_, idx) => idx !== i))}
                                                                        className="p-1 text-stone-400 hover:text-red-500 transition-colors flex-shrink-0"
                                                                    >
                                                                        <Trash className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <input
                                                                type="text"
                                                                value={newDefTerm}
                                                                onChange={(e) => setNewDefTerm(e.target.value)}
                                                                placeholder="Term"
                                                                className="w-28 px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                                                            />
                                                            <input
                                                                type="text"
                                                                value={newDefText}
                                                                onChange={(e) => setNewDefText(e.target.value)}
                                                                placeholder="Definition"
                                                                className="flex-1 px-3 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter' && newDefTerm.trim() && newDefText.trim()) {
                                                                        setDefBlocks(prev => [...prev, { term: newDefTerm.trim(), def: newDefText.trim() }]);
                                                                        setNewDefTerm('');
                                                                        setNewDefText('');
                                                                    }
                                                                }}
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    if (newDefTerm.trim() && newDefText.trim()) {
                                                                        setDefBlocks(prev => [...prev, { term: newDefTerm.trim(), def: newDefText.trim() }]);
                                                                        setNewDefTerm('');
                                                                        setNewDefText('');
                                                                    }
                                                                }}
                                                                className="px-3 py-2 rounded-lg bg-stone-900 text-white text-sm hover:bg-stone-800 transition-colors"
                                                            >
                                                                <Plus className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                        {defBlocks.length > 0 && (
                                                            <button
                                                                type="button"
                                                                onClick={injectDefBlocks}
                                                                className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-600 hover:text-amber-700 transition-colors"
                                                            >
                                                                <Zap className="w-3 h-3" /> Inject {defBlocks.length} block{defBlocks.length > 1 ? 's' : ''} as grid into content
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : selectedArticle ? (
                                // ─── VIEW MODE ─────────────────────────────────
                                <div className="bg-white rounded-2xl shadow-lg border border-stone-200 overflow-hidden">
                                    {/* View Header */}
                                    <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
                                        <div className="flex items-center gap-3">
                                            <StatusBadge status={selectedArticle.status} />
                                            <span className="text-sm text-stone-500">
                                                {selectedArticle.status === 'published'
                                                    ? `Published ${formatDate(selectedArticle.publishedAt)}`
                                                    : `Last updated ${formatDate(selectedArticle.updatedAt)}`
                                                }
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {selectedArticle.status === 'published' && (
                                                <Link
                                                    href={`/research/${selectedArticle.slug}`}
                                                    target="_blank"
                                                    className="flex items-center gap-1.5 px-3 py-2 text-stone-600 hover:text-stone-900 text-sm font-medium transition-colors"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                    View Live
                                                </Link>
                                            )}
                                            <button
                                                onClick={() => handleEdit(selectedArticle)}
                                                className="flex items-center gap-1.5 px-4 py-2 bg-stone-200 text-stone-800 rounded-lg hover:bg-stone-300 transition-colors text-sm font-medium"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                                Edit
                                            </button>
                                            {selectedArticle.status === 'draft' ? (
                                                <button
                                                    onClick={() => handlePublish(selectedArticle.id)}
                                                    className="flex items-center gap-1.5 px-4 py-2 bg-stone-900 text-white rounded-lg hover:bg-stone-800 transition-colors text-sm font-medium"
                                                >
                                                    <Globe className="w-4 h-4" />
                                                    Publish
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleUnpublish(selectedArticle.id)}
                                                    className="flex items-center gap-1.5 px-4 py-2 bg-amber-100 text-amber-800 rounded-lg hover:bg-amber-200 transition-colors text-sm font-medium"
                                                >
                                                    <Clock className="w-4 h-4" />
                                                    Unpublish
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleDelete(selectedArticle.id)}
                                                className="p-2 text-stone-400 hover:text-red-600 transition-colors"
                                                title="Delete article"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Article Preview */}
                                    <div className="p-8">
                                        <div className="max-w-2xl">
                                            <div className="flex items-center gap-3 mb-4">
                                                <span className="text-sm font-medium text-stone-500">{selectedArticle.category}</span>
                                                <span className="text-stone-300">·</span>
                                                <span className="text-sm text-stone-400">{selectedArticle.readTime}</span>
                                            </div>

                                            {selectedArticle.subtitle && (
                                                <p className="text-sm font-semibold uppercase tracking-widest text-stone-400 mb-2">
                                                    {selectedArticle.subtitle}
                                                </p>
                                            )}

                                            <h1 className="text-3xl font-bold text-stone-900 mb-4 leading-tight">
                                                {selectedArticle.title}
                                            </h1>

                                            <div className="flex items-center gap-3 mb-8">
                                                <div className="w-10 h-10 rounded-full bg-stone-900 flex items-center justify-center">
                                                    <span className="text-sm font-bold text-[#E0FE10]">
                                                        {selectedArticle.author.charAt(0).toUpperCase()}
                                                    </span>
                                                </div>
                                                <div>
                                                    <p className="text-sm font-semibold text-stone-800">{selectedArticle.author}</p>
                                                    <p className="text-xs text-stone-400">{formatDate(selectedArticle.createdAt)}</p>
                                                </div>
                                            </div>

                                            {selectedArticle.featuredImage && (
                                                <div className="aspect-video mb-8 rounded-xl overflow-hidden bg-stone-100">
                                                    <img
                                                        src={selectedArticle.featuredImage}
                                                        alt={selectedArticle.title}
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                            )}

                                            <div className="prose prose-stone max-w-none">
                                                <p className="text-lg text-stone-600 leading-relaxed mb-6">
                                                    {selectedArticle.excerpt}
                                                </p>
                                                <pre className="whitespace-pre-wrap text-sm text-stone-700 font-sans leading-relaxed bg-stone-50 p-4 rounded-lg">
                                                    {selectedArticle.content.substring(0, 1000)}
                                                    {selectedArticle.content.length > 1000 && '...'}
                                                </pre>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                // ─── EMPTY STATE ───────────────────────────────
                                <div className="bg-white rounded-2xl shadow-lg border border-stone-200 h-[calc(100vh-200px)] flex items-center justify-center">
                                    <div className="text-center">
                                        <div className="w-16 h-16 rounded-full bg-stone-100 flex items-center justify-center mx-auto mb-4">
                                            <FileText className="w-8 h-8 text-stone-400" />
                                        </div>
                                        <h3 className="text-lg font-semibold text-stone-900 mb-1">No article selected</h3>
                                        <p className="text-stone-500 mb-6">Select an article from the list or create a new one</p>
                                        <button
                                            onClick={handleNewArticle}
                                            className="flex items-center gap-2 px-4 py-2.5 bg-stone-900 text-white rounded-lg hover:bg-stone-800 transition-colors font-medium text-sm mx-auto"
                                        >
                                            <Plus className="w-4 h-4" />
                                            New Article
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Toast Message */}
            {message && (
                <div className={`fixed bottom-6 right-6 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl transition-all duration-300 ${message.type === 'success'
                    ? 'bg-emerald-900 text-white'
                    : 'bg-red-900 text-white'
                    }`}>
                    {message.type === 'success' ? (
                        <CheckCircle className="w-5 h-5 text-emerald-300" />
                    ) : (
                        <AlertCircle className="w-5 h-5 text-red-300" />
                    )}
                    <span className="font-medium">{message.text}</span>
                </div>
            )}
        </AdminRouteGuard>
    );
};

export default ResearchArticlesAdmin;
