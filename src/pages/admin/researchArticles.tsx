import React, { useState, useEffect, useCallback } from 'react';
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
import { db } from '../../api/firebase/config';
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
    Bold,
    Italic,
    Quote,
    List,
    Heading1,
    Heading2,
    Link as LinkIcon
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
    const buttons = [
        { icon: <Heading1 className="w-4 h-4" />, action: 'h1', title: 'Heading 1' },
        { icon: <Heading2 className="w-4 h-4" />, action: 'h2', title: 'Heading 2' },
        { icon: <Bold className="w-4 h-4" />, action: 'bold', title: 'Bold' },
        { icon: <Italic className="w-4 h-4" />, action: 'italic', title: 'Italic' },
        { icon: <Quote className="w-4 h-4" />, action: 'quote', title: 'Quote' },
        { icon: <List className="w-4 h-4" />, action: 'list', title: 'Bullet List' },
        { icon: <LinkIcon className="w-4 h-4" />, action: 'link', title: 'Link' },
    ];

    return (
        <div className="flex items-center gap-1 p-2 bg-stone-100 border-b border-stone-200 rounded-t-lg">
            {buttons.map((btn) => (
                <button
                    key={btn.action}
                    onClick={() => onAction(btn.action)}
                    title={btn.title}
                    className="p-2 text-stone-500 hover:text-stone-900 hover:bg-stone-200 rounded transition-colors"
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
    });

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

                            <button
                                onClick={handleNewArticle}
                                className="flex items-center gap-2 px-4 py-2.5 bg-stone-900 text-white rounded-lg hover:bg-stone-800 transition-colors font-medium text-sm"
                            >
                                <Plus className="w-4 h-4" />
                                New Article
                            </button>
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
                                                Publish
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
                                                <input
                                                    type="text"
                                                    value={formData.author}
                                                    onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                                                    className="w-full px-3 py-2 rounded-lg border border-stone-200 text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-400"
                                                />
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
                                                <label className="block text-xs font-medium text-stone-500 mb-1.5">Featured Image URL</label>
                                                <input
                                                    type="text"
                                                    value={formData.featuredImage}
                                                    onChange={(e) => setFormData({ ...formData, featuredImage: e.target.value })}
                                                    placeholder="/research-image.png"
                                                    className="w-full px-3 py-2 rounded-lg border border-stone-200 text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-400"
                                                />
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
                                            <label className="block text-xs font-medium text-stone-500 mb-1.5">Content</label>
                                            <div className="border border-stone-200 rounded-lg overflow-hidden">
                                                <EditorToolbar onAction={handleToolbarAction} />
                                                <textarea
                                                    id="content-editor"
                                                    value={formData.content}
                                                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                                    placeholder="Write your article content here... Use Markdown for formatting."
                                                    rows={20}
                                                    className="w-full px-4 py-4 text-stone-900 text-base leading-relaxed focus:outline-none resize-none bg-white font-mono text-sm"
                                                    style={{ fontFamily: "'SF Mono', 'Monaco', 'Menlo', monospace" }}
                                                />
                                            </div>
                                            <p className="mt-2 text-xs text-stone-400">
                                                Supports Markdown formatting. Use the toolbar or type directly.
                                            </p>
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
