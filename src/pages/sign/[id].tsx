import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { FileText, Check, AlertCircle, Download } from 'lucide-react';
import { doc, getDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../../api/firebase/config';

interface SigningRequest {
  id: string;
  // NOTE: historically this page supported template-based types ('advisor' | 'contractor').
  // We now also support generic, stored-document signing via `documentContent`.
  documentType: string;
  documentName: string;
  recipientName: string;
  // Optional: legal name to use in the agreement body (without altering signature)
  recipientLegalName?: string;
  recipientEmail: string;
  status: 'pending' | 'sent' | 'viewed' | 'signed';
  createdAt: Timestamp;
  sentAt?: Timestamp;
  viewedAt?: Timestamp;
  signedAt?: Timestamp;
  signatureData?: {
    typedName: string;
    signatureFont: string;
    ipAddress: string;
    userAgent: string;
    timestamp: Timestamp;
  };
  // For generic documents (e.g. Equity/Legal docs) we store the actual doc body here.
  documentContent?: string;
}

// Signature fonts available
const signatureFonts = [
  { name: 'Brush Script MT', class: 'font-brush' },
  { name: 'Segoe Script', class: 'font-segoe' },
  { name: 'Lucida Handwriting', class: 'font-lucida' },
];

const SignDocument: React.FC = () => {
  const router = useRouter();
  const { id, download } = router.query;
  
  const [request, setRequest] = useState<SigningRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typedName, setTypedName] = useState('');
  const [selectedFont, setSelectedFont] = useState(0);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);
  const downloadTriggeredRef = useRef(false);

  const legalName = useMemo(() => {
    const typed = request?.signatureData?.typedName || typedName;
    return (typed || request?.recipientName || '').trim();
  }, [request?.recipientName, request?.signatureData?.typedName, typedName]);

  useEffect(() => {
    if (id) {
      fetchSigningRequest(id as string);
    }
  }, [id]);

  const fetchSigningRequest = async (documentId: string) => {
    try {
      setLoading(true);
      const docRef = doc(db, 'signingRequests', documentId);
      const docSnap = await getDoc(docRef);
      
      if (!docSnap.exists()) {
        setError('Document not found or link has expired.');
        return;
      }
      
      const data = docSnap.data() as SigningRequest;
      setRequest({ ...data, id: docSnap.id });
      
      // Mark as viewed if not already signed
      if (data.status !== 'signed' && data.status !== 'viewed') {
        await updateDoc(docRef, {
          status: 'viewed',
          viewedAt: serverTimestamp(),
        });
      }
      
      if (data.status === 'signed') {
        setSigned(true);
        setTypedName(data.signatureData?.typedName || '');
        const fontIdx = signatureFonts.findIndex(f => f.name === data.signatureData?.signatureFont);
        if (fontIdx >= 0) setSelectedFont(fontIdx);
      }
    } catch (err) {
      console.error('Error fetching signing request:', err);
      setError('Failed to load document. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // If opened with ?download=true on a signed request, auto-generate the signed PDF
  useEffect(() => {
    if (!signed || !request) return;
    if (!download) return;
    if (downloadTriggeredRef.current) return;
    downloadTriggeredRef.current = true;
    generateSignedPdf();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [download, request, signed]);

  const handleSign = async () => {
    if (!request || !typedName.trim() || !agreedToTerms) return;
    
    setSigning(true);
    
    try {
      // Get IP address (client-side approximation - in production use a server endpoint)
      let ipAddress = 'Unknown';
      try {
        const ipResponse = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipResponse.json();
        ipAddress = ipData.ip;
      } catch {
        console.log('Could not fetch IP');
      }
      
      const signatureData = {
        typedName: typedName.trim(),
        signatureFont: signatureFonts[selectedFont].name,
        ipAddress,
        userAgent: navigator.userAgent,
        timestamp: serverTimestamp(),
      };
      
      // Update the document in Firestore
      const docRef = doc(db, 'signingRequests', request.id);
      await updateDoc(docRef, {
        status: 'signed',
        signedAt: serverTimestamp(),
        signatureData,
      });
      
      // Send confirmation email via Netlify function
      await fetch('/.netlify/functions/send-signed-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: request.id,
          documentName: request.documentName,
          recipientName: request.recipientName,
          recipientEmail: request.recipientEmail,
          signedAt: new Date().toISOString(),
          typedName: typedName.trim(),
        }),
      });
      
      setSigned(true);
    } catch (err) {
      console.error('Error signing document:', err);
      setError('Failed to sign document. Please try again.');
    } finally {
      setSigning(false);
    }
  };

  const generateSignedPdf = () => {
    if (!request) return;
    
    const currentDate = new Date().toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
    
    // Preserve original signature font if already signed
    const signedFontIdx = signatureFonts.findIndex(f => f.name === request.signatureData?.signatureFont);
    const fontIdxToUse = signedFontIdx >= 0 ? signedFontIdx : selectedFont;
    const signatureStyle = `font-family: '${signatureFonts[fontIdxToUse].name}', cursive; font-size: 28px; color: #1a1a1a;`;
    
    // Generate different documents based on type
    const signatureName = (request.signatureData?.typedName || typedName || request.recipientName).trim();
    // Agreement party name should be the legal name (if provided), otherwise fall back to signature name
    const agreementName = (request.recipientLegalName || '').trim() || signatureName || request.recipientName.trim();
    const documentContent = request.documentContent
      ? generateGenericSignedHtml(request.documentName, request.documentContent, currentDate, signatureName, signatureStyle)
      : request.documentType === 'advisor'
        ? generateAdvisorAgreementHtml(agreementName, currentDate, signatureName, signatureStyle)
        : generateContractorAgreementHtml(agreementName, currentDate, signatureName, signatureStyle);
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(documentContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  };

  const formatTextToHtml = (text: string) => {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h2>$1</h2>')
      .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
      .replace(/^[-•]\s+(.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
      .split('\n\n')
      .map(para => {
        if (para.startsWith('<h') || para.startsWith('<ul') || para.startsWith('<ol')) return para;
        return `<p>${para.replace(/\n/g, '<br>')}</p>`;
      })
      .join('\n');
  };

  const generateGenericSignedHtml = (title: string, content: string, date: string, signature: string, signatureStyle: string) => `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Signed - ${title}</title>
        <style>
          @page { margin: 1in; }
          body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 1.6; color: #111; max-width: 8.5in; margin: 0 auto; padding: 40px; }
          h1 { font-size: 18pt; font-weight: bold; text-align: center; margin-bottom: 24px; text-transform: uppercase; border-bottom: 2px solid #333; padding-bottom: 12px; }
          h2 { font-size: 14pt; font-weight: bold; margin-top: 24px; margin-bottom: 12px; }
          h3 { font-size: 12pt; font-weight: bold; margin-top: 18px; margin-bottom: 8px; }
          p { margin-bottom: 12px; text-align: justify; }
          ul, ol { margin: 12px 0; padding-left: 24px; }
          li { margin-bottom: 8px; }
          .header { text-align: center; margin-bottom: 30px; }
          .company-name { font-size: 14pt; font-weight: bold; margin-bottom: 4px; }
          .document-date { font-size: 10pt; color: #666; margin-bottom: 20px; }
          .signature-block { margin-top: 60px; page-break-inside: avoid; }
          .signature-line { border-bottom: 1px solid #333; width: 250px; margin: 40px 0 8px 0; min-height: 35px; display: flex; align-items: flex-end; }
          .signature-label { font-size: 10pt; color: #666; }
          .signed-badge { display: inline-block; background: #10b981; color: white; padding: 4px 12px; border-radius: 4px; font-size: 11px; margin-left: 10px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">PULSE INTELLIGENCE LABS, INC.</div>
          <div class="document-date">Signed: ${date}</div>
        </div>
        <h1>${title} <span class="signed-badge">✓ SIGNED</span></h1>
        <div class="content">
          ${formatTextToHtml(content)}
        </div>

        <div class="signature-block">
          <p>IN WITNESS WHEREOF, the undersigned have executed this document as of the date first written above.</p>
          <div style="display: flex; justify-content: space-between; flex-wrap: wrap;">
            <div style="width: 45%;">
              <div class="signature-line" style="${signatureStyle}">Tremaine Grant</div>
              <div class="signature-label">Signature (Company)</div>
              <div class="signature-line" style="margin-top: 20px;"></div>
              <div class="signature-label">Printed Name</div>
              <div class="signature-line" style="margin-top: 20px;"></div>
              <div class="signature-label">Date</div>
            </div>
            <div style="width: 45%;">
              <div class="signature-line" style="${signatureStyle}">${signature}</div>
              <div class="signature-label">Signature (Recipient)</div>
              <div class="signature-line" style="margin-top: 20px;"></div>
              <div class="signature-label">Printed Name</div>
              <div class="signature-line" style="margin-top: 20px;"></div>
              <div class="signature-label">Date</div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  const generateAdvisorAgreementHtml = (name: string, date: string, signature: string, signatureStyle: string) => `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Signed - Independent Advisor Agreement</title>
        <style>
          body { font-family: 'Times New Roman', Times, serif; padding: 50px 60px; color: #111; margin: 0; line-height: 1.6; font-size: 14px; }
          h1 { font-size: 18px; text-align: center; margin-bottom: 20px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
          .intro { margin-bottom: 30px; text-align: justify; }
          h3 { font-size: 14px; margin-top: 25px; margin-bottom: 10px; font-weight: bold; }
          p { margin-bottom: 12px; text-align: justify; }
          .highlight { font-weight: bold; }
          .signature-section { margin-top: 50px; page-break-before: always; padding-top: 40px; }
          .signature-block { margin-top: 40px; }
          .signature-line { border-bottom: 1px solid #333; width: 250px; margin-bottom: 5px; min-height: 35px; display: flex; align-items: flex-end; }
          .signature-name { font-weight: bold; }
          .signature-title { color: #666; font-size: 12px; }
          .date-row { display: flex; align-items: center; gap: 10px; margin-top: 15px; }
          .date-label { font-weight: bold; }
          .date-value { border-bottom: 1px solid #333; min-width: 150px; padding-bottom: 2px; }
          .signed-badge { display: inline-block; background: #10b981; color: white; padding: 4px 12px; border-radius: 4px; font-size: 11px; margin-left: 10px; }
          .audit-info { margin-top: 40px; padding: 15px; background: #f9fafb; border: 1px solid #e5e5e5; border-radius: 8px; font-size: 11px; color: #666; }
          .footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #ccc; font-size: 11px; color: #666; text-align: center; }
          @media print { body { padding: 30px 40px; } .signature-section { page-break-before: always; } }
        </style>
      </head>
      <body>
        <h1>Independent Advisor / Trial Contractor Agreement <span class="signed-badge">✓ SIGNED</span></h1>
        
        <p class="intro">
          This Independent Advisor / Trial Contractor Agreement (the "Agreement") is entered into as of <span class="highlight">${date}</span> (the "Effective Date"), by and between <span class="highlight">Pulse Intelligence Labs, Inc.</span>, a Delaware corporation (the "Company"), and <span class="highlight">${name}</span> ("Advisor").
        </p>
        
        <h3>1. Advisory Relationship</h3>
        <p>The Company engages Advisor in a non-exclusive, advisory and trial capacity, and Advisor agrees to provide strategic, operational, and organizational support services as requested by the Company from time to time (the "Services"). Advisor's role is exploratory and intended to evaluate potential future collaboration.</p>
        
        <h3>2. No Employment Relationship</h3>
        <p>Advisor acknowledges and agrees that Advisor is not an employee, officer, or agent of the Company. Nothing in this Agreement creates an employment relationship, partnership, joint venture, or agency relationship between the parties.</p>
        
        <h3>3. Compensation</h3>
        <p>Advisor will not receive any salary, wages, fees, or other compensation for Services performed under this Agreement unless and until otherwise agreed in writing by the Company. Advisor acknowledges that no equity, ownership interest, or future compensation is granted or promised under this Agreement.</p>
        
        <h3>4. Intellectual Property Assignment</h3>
        <p>Advisor hereby irrevocably assigns to the Company all right, title, and interest in and to any and all inventions, works of authorship, developments, designs, software, documentation, processes, trade secrets, ideas, and other intellectual property conceived, created, or reduced to practice by Advisor, solely or jointly with others, in connection with or related to the Services or the Company's business (the "Work Product"). Advisor agrees to execute any documents reasonably necessary to confirm or perfect such assignment.</p>
        
        <h3>5. Confidentiality</h3>
        <p>Advisor agrees to hold in strict confidence all non-public information disclosed by the Company, including but not limited to product plans, business strategies, financial information, technical data, and customer information ("Confidential Information"). Advisor shall not disclose or use Confidential Information for any purpose other than performing Services under this Agreement.</p>
        
        <h3>6. Term and Termination</h3>
        <p>This Agreement shall commence on the Effective Date and may be terminated at any time by either party, with or without cause, upon written notice to the other party. Upon termination, Advisor shall promptly return or destroy all Company materials and Confidential Information.</p>
        
        <h3>7. No Obligation</h3>
        <p>Nothing in this Agreement obligates either party to enter into any future employment, equity, or co-founder relationship. Any such relationship would require a separate written agreement.</p>
        
        <h3>8. Governing Law</h3>
        <p>This Agreement shall be governed by and construed in accordance with the laws of the State of Delaware, without regard to conflict of laws principles.</p>
        
        <div class="signature-section">
          <p>IN WITNESS WHEREOF, the parties have executed this Agreement as of the Effective Date.</p>
          
          <div class="signature-block">
            <p class="signature-name">Pulse Intelligence Labs, Inc.</p>
            <div class="signature-line" style="${signatureStyle}">Tremaine Grant</div>
            <p>By: Tremaine Grant</p>
            <p class="signature-title">Title: CEO</p>
            <div class="date-row">
              <span class="date-label">Date:</span>
              <span class="date-value">${date}</span>
            </div>
          </div>
          
          <div class="signature-block">
            <p class="signature-name">Advisor:</p>
            <div class="signature-line" style="${signatureStyle}">${signature}</div>
            <p>${name}</p>
            <div class="date-row">
              <span class="date-label">Date:</span>
              <span class="date-value">${date}</span>
            </div>
          </div>
        </div>
        
        <div class="audit-info">
          <strong>Electronic Signature Audit Trail</strong><br>
          Document signed electronically on ${date}<br>
          Signer (legal name): ${name}<br>
          Typed signature: ${signature}<br>
          This document is legally binding under the ESIGN Act and UETA.
        </div>
        
        <div class="footer">
          <p>© ${new Date().getFullYear()} Pulse Intelligence Labs, Inc. All rights reserved.</p>
        </div>
      </body>
    </html>
  `;

  const generateContractorAgreementHtml = (name: string, date: string, signature: string, signatureStyle: string) => `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Signed - Independent Contractor Agreement</title>
        <style>
          body { font-family: 'Times New Roman', Times, serif; padding: 50px 60px; color: #111; margin: 0; line-height: 1.6; font-size: 14px; }
          h1 { font-size: 18px; text-align: center; margin-bottom: 20px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
          .intro { margin-bottom: 30px; text-align: justify; }
          h3 { font-size: 14px; margin-top: 25px; margin-bottom: 10px; font-weight: bold; }
          p { margin-bottom: 12px; text-align: justify; }
          .highlight { font-weight: bold; }
          .subsection { margin-left: 20px; margin-top: 10px; }
          .subsection-title { font-weight: bold; margin-bottom: 5px; }
          .signature-section { margin-top: 50px; page-break-before: always; padding-top: 40px; }
          .signature-block { margin-top: 40px; }
          .signature-line { border-bottom: 1px solid #333; width: 250px; margin-bottom: 5px; min-height: 35px; display: flex; align-items: flex-end; }
          .signature-name { font-weight: bold; }
          .signature-title { color: #666; font-size: 12px; }
          .date-row { display: flex; align-items: center; gap: 10px; margin-top: 15px; }
          .date-label { font-weight: bold; }
          .date-value { border-bottom: 1px solid #333; min-width: 150px; padding-bottom: 2px; }
          .signed-badge { display: inline-block; background: #10b981; color: white; padding: 4px 12px; border-radius: 4px; font-size: 11px; margin-left: 10px; }
          .audit-info { margin-top: 40px; padding: 15px; background: #f9fafb; border: 1px solid #e5e5e5; border-radius: 8px; font-size: 11px; color: #666; }
          .footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #ccc; font-size: 11px; color: #666; text-align: center; }
          @media print { body { padding: 30px 40px; } .signature-section { page-break-before: always; } }
        </style>
      </head>
      <body>
        <h1>Independent Contractor Agreement <span class="signed-badge">✓ SIGNED</span></h1>
        
        <p class="intro">
          This Independent Contractor Agreement (the "Agreement") is entered into as of <span class="highlight">${date}</span> (the "Effective Date"), by and between <span class="highlight">Pulse Intelligence Labs, Inc.</span>, a Delaware corporation (the "Company"), and <span class="highlight">${name}</span> ("Contractor").
        </p>
        
        <h3>1. Services</h3>
        <p>Contractor agrees to provide product design and related creative services, including but not limited to UI/UX design, visual assets, and design support, as requested by the Company from time to time (the "Services").</p>
        
        <h3>2. Independent Contractor Relationship</h3>
        <p>Contractor is an independent contractor and not an employee, partner, agent, or representative of the Company. Contractor shall have no authority to bind the Company. Contractor is solely responsible for all taxes, withholdings, and other statutory, regulatory, or contractual obligations of any sort arising from compensation paid under this Agreement.</p>
        
        <h3>3. Compensation</h3>
        <p>Company shall pay Contractor a monthly retainer of <span class="highlight">$100 USD</span> for Services performed under this Agreement, unless otherwise agreed in writing by the parties. Payments shall be made electronically. Contractor acknowledges that no benefits, equity, or additional compensation are provided.</p>
        
        <h3>4. Intellectual Property Assignment</h3>
        <div class="subsection">
          <p class="subsection-title">(a) Assignment</p>
          <p>Contractor hereby irrevocably assigns to the Company all right, title, and interest in and to any and all work product, deliverables, designs, inventions, improvements, works of authorship, software, trade secrets, and other intellectual property created, conceived, reduced to practice, or developed by Contractor, solely or jointly with others, in connection with the Services or relating to the Company's business, products, or technology (collectively, the "Work Product"). To the extent any Work Product does not qualify as a "work made for hire," Contractor hereby assigns all right, title, and interest therein to the Company.</p>
        </div>
        <div class="subsection">
          <p class="subsection-title">(b) Retroactive Assignment of Prior Work</p>
          <p>Contractor acknowledges that Contractor has previously provided services to the Company prior to the Effective Date of this Agreement. Contractor hereby irrevocably assigns to the Company all right, title, and interest in and to any and all Work Product created by Contractor for or on behalf of the Company at any time prior to or after the Effective Date, whether or not such work was created under a prior informal or unwritten arrangement.</p>
        </div>
        <div class="subsection">
          <p class="subsection-title">(c) Further Assurances</p>
          <p>Contractor agrees to execute any documents and take any actions reasonably necessary to confirm or perfect the Company's ownership of the Work Product.</p>
        </div>
        
        <h3>5. Confidentiality</h3>
        <p>Contractor agrees to hold in strict confidence all non-public, proprietary, or confidential information disclosed by the Company, including but not limited to product designs, source materials, business plans, technical information, customer data, and trade secrets ("Confidential Information"). Contractor shall not disclose or use Confidential Information for any purpose other than performing Services under this Agreement.</p>
        
        <h3>6. International Contractor Acknowledgment</h3>
        <p>Contractor represents that Contractor is located outside of the United States and acknowledges that Contractor is solely responsible for compliance with all applicable local laws, regulations, and tax obligations in Contractor's jurisdiction.</p>
        
        <h3>7. Term and Termination</h3>
        <p>This Agreement shall commence on the Effective Date and may be terminated by either party at any time, with or without cause, upon written notice. Upon termination, Contractor shall promptly return or destroy all Company materials and Confidential Information.</p>
        
        <h3>8. No Equity or Employment Rights</h3>
        <p>Nothing in this Agreement grants Contractor any equity interest, ownership rights, or right to future employment with the Company, whether express or implied.</p>
        
        <h3>9. Governing Law</h3>
        <p>This Agreement shall be governed by and construed in accordance with the laws of the State of Delaware, without regard to conflict of laws principles.</p>
        
        <div class="signature-section">
          <p>IN WITNESS WHEREOF, the parties have executed this Agreement as of the Effective Date.</p>
          
          <div class="signature-block">
            <p class="signature-name">Pulse Intelligence Labs, Inc.</p>
            <div class="signature-line" style="${signatureStyle}">Tremaine Grant</div>
            <p>By: Tremaine Grant</p>
            <p class="signature-title">Title: CEO</p>
            <div class="date-row">
              <span class="date-label">Date:</span>
              <span class="date-value">${date}</span>
            </div>
          </div>
          
          <div class="signature-block">
            <p class="signature-name">Contractor:</p>
            <div class="signature-line" style="${signatureStyle}">${signature}</div>
            <p>${name}</p>
            <div class="date-row">
              <span class="date-label">Date:</span>
              <span class="date-value">${date}</span>
            </div>
          </div>
        </div>
        
        <div class="audit-info">
          <strong>Electronic Signature Audit Trail</strong><br>
          Document signed electronically on ${date}<br>
          Signer (legal name): ${name}<br>
          Typed signature: ${signature}<br>
          This document is legally binding under the ESIGN Act and UETA.
        </div>
        
        <div class="footer">
          <p>© ${new Date().getFullYear()} Pulse Intelligence Labs, Inc. All rights reserved.</p>
        </div>
      </body>
    </html>
  `;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="text-white">Loading document...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center p-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-white text-xl font-semibold mb-2">Unable to Load Document</h1>
          <p className="text-zinc-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!request) return null;

  return (
    <>
      <Head>
        <title>Sign Document | {request.documentName}</title>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&family=Great+Vibes&family=Pacifico&display=swap');
          .font-dancing { font-family: 'Dancing Script', cursive; }
          .font-vibes { font-family: 'Great Vibes', cursive; }
          .font-pacifico { font-family: 'Pacifico', cursive; }
        `}</style>
      </Head>
      
      <div className="min-h-screen bg-[#0d1117] text-white">
        {/* Header */}
        <div className="bg-zinc-900 border-b border-zinc-800 py-4 px-6">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/PulseLogo.png" alt="Pulse" className="h-8" />
              <span className="text-zinc-400">Document Signing</span>
            </div>
            {signed && (
              <span className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 text-green-400 rounded-full text-sm">
                <Check className="w-4 h-4" />
                Signed
              </span>
            )}
          </div>
        </div>
        
        <div className="max-w-4xl mx-auto p-6">
          {/* Document Info */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 mb-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl bg-[#E0FE10]/10 flex items-center justify-center">
                <FileText className="w-6 h-6 text-[#E0FE10]" />
              </div>
              <div>
                <h1 className="text-xl font-semibold">{request.documentName}</h1>
                <p className="text-zinc-400">Prepared for: {legalName || request.recipientName}</p>
              </div>
            </div>
            <p className="text-zinc-500 text-sm">
              From: Pulse Intelligence Labs, Inc. • Sent to: {request.recipientEmail}
            </p>
          </div>
          
          {signed ? (
            /* Signed State */
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-400" />
              </div>
              <h2 className="text-2xl font-semibold mb-2">Document Signed Successfully</h2>
              <p className="text-zinc-400 mb-6">
                Thank you for signing. A confirmation email has been sent to all parties.
              </p>
              
              <div className="bg-zinc-800/50 rounded-xl p-4 mb-6 inline-block">
                <p className="text-zinc-400 text-sm mb-2">Your Signature</p>
                <p className={`text-3xl ${selectedFont === 0 ? 'font-dancing' : selectedFont === 1 ? 'font-vibes' : 'font-pacifico'}`}>
                  {typedName}
                </p>
              </div>
              
              <div>
                <button
                  onClick={generateSignedPdf}
                  className="flex items-center gap-2 px-6 py-3 bg-[#E0FE10] hover:bg-[#c8e60e] text-black rounded-xl font-medium transition-colors mx-auto"
                >
                  <Download className="w-5 h-5" />
                  Download Signed Document
                </button>
              </div>
            </div>
          ) : (
            /* Signing State */
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
              <h2 className="text-lg font-semibold mb-6">Sign Document</h2>
              
              {/* Type Name */}
              <div className="mb-6">
                <label className="block text-zinc-400 text-sm mb-2">Type your full legal name</label>
                <input
                  type="text"
                  value={typedName}
                  onChange={(e) => setTypedName(e.target.value)}
                  placeholder={request.recipientName}
                  className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-[#E0FE10] text-lg"
                />
              </div>
              
              {/* Signature Preview */}
              {typedName && (
                <div className="mb-6">
                  <label className="block text-zinc-400 text-sm mb-3">Select signature style</label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {['font-dancing', 'font-vibes', 'font-pacifico'].map((font, index) => (
                      <button
                        key={font}
                        onClick={() => setSelectedFont(index)}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          selectedFont === index
                            ? 'border-[#E0FE10] bg-[#E0FE10]/10'
                            : 'border-zinc-700 hover:border-zinc-600'
                        }`}
                      >
                        <p className={`text-2xl text-white ${font}`}>{typedName}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Terms Agreement */}
              <div className="mb-6 p-4 bg-zinc-800/50 rounded-xl">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="mt-1 w-5 h-5 rounded border-zinc-600 bg-zinc-700 text-[#E0FE10] focus:ring-[#E0FE10] focus:ring-offset-0"
                  />
                  <span className="text-zinc-300 text-sm">
                    I agree to sign this document electronically. I understand that my electronic signature 
                    is legally binding and has the same legal effect as a handwritten signature under the 
                    ESIGN Act and UETA. I consent to conduct this transaction electronically.
                  </span>
                </label>
              </div>
              
              {/* Sign Button */}
              <button
                onClick={handleSign}
                disabled={!typedName.trim() || !agreedToTerms || signing}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-[#E0FE10] hover:bg-[#c8e60e] disabled:bg-zinc-700 disabled:text-zinc-500 text-black rounded-xl font-semibold text-lg transition-colors"
              >
                {signing ? (
                  'Signing...'
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    Sign Document
                  </>
                )}
              </button>
              
              <p className="text-zinc-500 text-xs text-center mt-4">
                By clicking "Sign Document", you are applying your electronic signature to this agreement.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default SignDocument;




