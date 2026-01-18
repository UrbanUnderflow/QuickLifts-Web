import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  Shield,
  AlertOctagon,
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  ChevronDown,
  ChevronUp,
  Search,
  Eye,
  EyeOff,
  Copy,
  CheckCircle2,
  Upload,
  Wand2,
  Loader2
} from 'lucide-react';
import AdminRouteGuard from '../../components/auth/AdminRouteGuard';
import { useUser } from '../../hooks/useUser';
import {
  EscalationTier,
  EscalationCategory,
  EscalationCondition,
  EscalationConditionInput,
  getTierLabel,
  getTierColor,
  getCategoryLabel
} from '../../api/firebase/escalation/types';
import { escalationConditionsService } from '../../api/firebase/escalation/service';

// ============================================================================
// Tier Configuration
// ============================================================================

const tierConfig = [
  {
    tier: EscalationTier.MonitorOnly,
    label: 'Tier 1: Monitor Only',
    description: 'Adaptive AI support with coach notification. No clinical escalation.',
    icon: <Eye className="w-5 h-5" />,
    gradient: 'from-blue-500 to-blue-600',
    categories: [
      EscalationCategory.PerformanceStress,
      EscalationCategory.Fatigue,
      EscalationCategory.EmotionalVariability,
      EscalationCategory.Burnout
    ]
  },
  {
    tier: EscalationTier.ElevatedRisk,
    label: 'Tier 2: Elevated Risk',
    description: 'Consent-based clinical escalation. User chooses to connect with professional support.',
    icon: <AlertTriangle className="w-5 h-5" />,
    gradient: 'from-orange-500 to-orange-600',
    categories: [
      EscalationCategory.PersistentDistress,
      EscalationCategory.AnxietyIndicators,
      EscalationCategory.DisorderedEating,
      EscalationCategory.IdentityImpact,
      EscalationCategory.InjuryPsychological,
      EscalationCategory.RecurrentTier1
    ]
  },
  {
    tier: EscalationTier.CriticalRisk,
    label: 'Tier 3: Critical Risk',
    description: 'MANDATORY clinical escalation. Immediate safety response required.',
    icon: <AlertOctagon className="w-5 h-5" />,
    gradient: 'from-red-500 to-red-600',
    categories: [
      EscalationCategory.SelfHarm,
      EscalationCategory.SuicidalIdeation,
      EscalationCategory.ImminentSafetyRisk,
      EscalationCategory.SeverePsychologicalDistress,
      EscalationCategory.AbuseDisclosure,
      EscalationCategory.RapidDeterioration
    ]
  }
];

// ============================================================================
// Condition Form Component
// ============================================================================

interface ConditionFormProps {
  condition?: EscalationCondition;
  tier: EscalationTier;
  categories: EscalationCategory[];
  onSave: (input: EscalationConditionInput) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
}

const ConditionForm: React.FC<ConditionFormProps> = ({
  condition,
  tier,
  categories,
  onSave,
  onCancel,
  isLoading
}) => {
  const [title, setTitle] = useState(condition?.title ?? '');
  const [description, setDescription] = useState(condition?.description ?? '');
  const [category, setCategory] = useState<EscalationCategory>(
    condition?.category ?? categories[0]
  );
  const [examplePhrases, setExamplePhrases] = useState<string[]>(
    condition?.examplePhrases ?? ['']
  );
  const [keywords, setKeywords] = useState<string[]>(condition?.keywords ?? ['']);
  const [priority, setPriority] = useState(condition?.priority ?? 0);
  const [isActive, setIsActive] = useState(condition?.isActive ?? true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      tier,
      category,
      title,
      description,
      examplePhrases: examplePhrases.filter(p => p.trim()),
      keywords: keywords.filter(k => k.trim()),
      priority,
      isActive
    });
  };

  const addExamplePhrase = () => setExamplePhrases([...examplePhrases, '']);
  const removeExamplePhrase = (index: number) => 
    setExamplePhrases(examplePhrases.filter((_, i) => i !== index));
  const updateExamplePhrase = (index: number, value: string) => {
    const updated = [...examplePhrases];
    updated[index] = value;
    setExamplePhrases(updated);
  };

  const addKeyword = () => setKeywords([...keywords, '']);
  const removeKeyword = (index: number) => 
    setKeywords(keywords.filter((_, i) => i !== index));
  const updateKeyword = (index: number, value: string) => {
    const updated = [...keywords];
    updated[index] = value;
    setKeywords(updated);
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      onSubmit={handleSubmit}
      className="bg-zinc-800/50 rounded-xl p-6 border border-zinc-700/50 space-y-4"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-1">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-[#d7ff00]/30 focus:border-[#d7ff00]/40"
            placeholder="e.g., Performance Anxiety"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-1">
            Category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as EscalationCategory)}
            className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-[#d7ff00]/30 focus:border-[#d7ff00]/40"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {getCategoryLabel(cat)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-400 mb-1">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-[#d7ff00]/30 focus:border-[#d7ff00]/40 min-h-[80px] resize-y"
          placeholder="Describe what this condition looks like and when it should trigger..."
          required
        />
      </div>

      {/* Example Phrases */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-zinc-400">
            Example Phrases (for AI training)
          </label>
          <button
            type="button"
            onClick={addExamplePhrase}
            className="text-xs text-[#d7ff00] hover:underline flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Add
          </button>
        </div>
        <div className="space-y-2">
          {examplePhrases.map((phrase, index) => (
            <div key={index} className="flex gap-2">
              <input
                type="text"
                value={phrase}
                onChange={(e) => updateExamplePhrase(index, e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-[#d7ff00]/30 focus:border-[#d7ff00]/40 text-sm"
                placeholder={`"I've been feeling really overwhelmed lately..."`}
              />
              {examplePhrases.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeExamplePhrase(index)}
                  className="p-2 text-zinc-500 hover:text-red-400 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Keywords */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-zinc-400">
            Keywords
          </label>
          <button
            type="button"
            onClick={addKeyword}
            className="text-xs text-[#d7ff00] hover:underline flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Add
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {keywords.map((keyword, index) => (
            <div key={index} className="flex items-center gap-1">
              <input
                type="text"
                value={keyword}
                onChange={(e) => updateKeyword(index, e.target.value)}
                className="w-32 px-2 py-1 rounded bg-zinc-900 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-[#d7ff00]/30 focus:border-[#d7ff00]/40 text-sm"
                placeholder="keyword"
              />
              {keywords.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeKeyword(index)}
                  className="text-zinc-500 hover:text-red-400 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Priority & Active */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-400 mb-1">
            Priority (0-10)
          </label>
          <input
            type="number"
            min={0}
            max={10}
            value={priority}
            onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
            className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-[#d7ff00]/30 focus:border-[#d7ff00]/40"
          />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-[#d7ff00] focus:ring-[#d7ff00]/30"
            />
            <span className="text-sm text-zinc-300">Active (used for AI classification)</span>
          </label>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t border-zinc-700/50">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-700/50 transition-colors"
          disabled={isLoading}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isLoading || !title.trim() || !description.trim()}
          className="px-4 py-2 rounded-lg bg-[#d7ff00] text-black font-medium hover:bg-[#d7ff00]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          {isLoading ? 'Saving...' : (condition ? 'Update' : 'Create')}
        </button>
      </div>
    </motion.form>
  );
};

// ============================================================================
// Condition Card Component
// ============================================================================

interface ConditionCardProps {
  condition: EscalationCondition;
  tierColor: { bg: string; text: string; border: string };
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
}

const ConditionCard: React.FC<ConditionCardProps> = ({
  condition,
  tierColor,
  onEdit,
  onDelete,
  onToggleActive
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    const text = `${condition.title}\n\n${condition.description}\n\nExamples:\n${condition.examplePhrases.map(p => `- "${p}"`).join('\n')}\n\nKeywords: ${condition.keywords.join(', ')}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`bg-zinc-800/30 rounded-xl overflow-hidden border transition-all ${
        condition.isActive ? 'border-zinc-700/50' : 'border-zinc-800 opacity-60'
      }`}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-zinc-700/20 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: tierColor.text }}
          />
          <div>
            <h4 className="font-medium text-white">{condition.title}</h4>
            <p className="text-xs text-zinc-500">
              {getCategoryLabel(condition.category)} · Priority: {condition.priority}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!condition.isActive && (
            <span className="px-2 py-0.5 rounded text-xs bg-zinc-700 text-zinc-400">
              Inactive
            </span>
          )}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-zinc-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-zinc-500" />
          )}
        </div>
      </div>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-zinc-700/30 pt-3">
              <p className="text-sm text-zinc-300">{condition.description}</p>

              {condition.examplePhrases.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-zinc-500 mb-1">Example Phrases:</p>
                  <div className="space-y-1">
                    {condition.examplePhrases.map((phrase, i) => (
                      <p key={i} className="text-sm text-zinc-400 italic">
                        "{phrase}"
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {condition.keywords.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-zinc-500 mb-1">Keywords:</p>
                  <div className="flex flex-wrap gap-1">
                    {condition.keywords.map((kw, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded text-xs bg-zinc-700/50 text-zinc-300"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2 border-t border-zinc-700/30">
                <button
                  onClick={(e) => { e.stopPropagation(); onEdit(); }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-zinc-300 hover:bg-zinc-700/50 transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" /> Edit
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleActive(); }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-zinc-300 hover:bg-zinc-700/50 transition-colors"
                >
                  {condition.isActive ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5" /> Disable
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5" /> Enable
                    </>
                  )}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); copyToClipboard(); }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-zinc-300 hover:bg-zinc-700/50 transition-colors"
                >
                  {copied ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" /> Copy
                    </>
                  )}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(); }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition-colors ml-auto"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ============================================================================
// Tier Section Component
// ============================================================================

interface TierSectionProps {
  config: typeof tierConfig[0];
  conditions: EscalationCondition[];
  onCreateCondition: (tier: EscalationTier, input: EscalationConditionInput) => Promise<void>;
  onUpdateCondition: (id: string, input: Partial<EscalationConditionInput>) => Promise<void>;
  onDeleteCondition: (id: string) => Promise<void>;
  onToggleActive: (id: string, isActive: boolean) => Promise<void>;
}

const TierSection: React.FC<TierSectionProps> = ({
  config,
  conditions,
  onCreateCondition,
  onUpdateCondition,
  onDeleteCondition,
  onToggleActive
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingCondition, setEditingCondition] = useState<EscalationCondition | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const tierColor = getTierColor(config.tier);
  const tierConditions = conditions.filter(c => c.tier === config.tier);

  const handleSaveNew = async (input: EscalationConditionInput) => {
    setIsLoading(true);
    try {
      await onCreateCondition(config.tier, input);
      setIsAddingNew(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveEdit = async (input: EscalationConditionInput) => {
    if (!editingCondition) return;
    setIsLoading(true);
    try {
      await onUpdateCondition(editingCondition.id, input);
      setEditingCondition(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-[#1a1e24] rounded-xl overflow-hidden shadow-xl">
      {/* Tier Header */}
      <div
        className={`relative p-4 cursor-pointer`}
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ background: `linear-gradient(135deg, ${tierColor.bg}, transparent)` }}
      >
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${config.gradient}" 
          style={{ background: `linear-gradient(to right, ${tierColor.text}, ${tierColor.border})` }}
        />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: tierColor.bg, color: tierColor.text }}
            >
              {config.icon}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">{config.label}</h3>
              <p className="text-sm text-zinc-400">{config.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full text-sm font-medium"
              style={{ backgroundColor: tierColor.bg, color: tierColor.text }}
            >
              {tierConditions.length} conditions
            </span>
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-zinc-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-zinc-400" />
            )}
          </div>
        </div>
      </div>

      {/* Tier Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-3">
              {/* Add New Button */}
              {!isAddingNew && !editingCondition && (
                <button
                  onClick={() => setIsAddingNew(true)}
                  className="w-full py-3 rounded-xl border-2 border-dashed border-zinc-700 text-zinc-400 hover:border-[#d7ff00]/50 hover:text-[#d7ff00] transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Condition
                </button>
              )}

              {/* New Condition Form */}
              {isAddingNew && (
                <ConditionForm
                  tier={config.tier}
                  categories={config.categories}
                  onSave={handleSaveNew}
                  onCancel={() => setIsAddingNew(false)}
                  isLoading={isLoading}
                />
              )}

              {/* Edit Condition Form */}
              {editingCondition && (
                <ConditionForm
                  condition={editingCondition}
                  tier={config.tier}
                  categories={config.categories}
                  onSave={handleSaveEdit}
                  onCancel={() => setEditingCondition(null)}
                  isLoading={isLoading}
                />
              )}

              {/* Conditions List */}
              <AnimatePresence>
                {tierConditions.map((condition) => (
                  <ConditionCard
                    key={condition.id}
                    condition={condition}
                    tierColor={tierColor}
                    onEdit={() => setEditingCondition(condition)}
                    onDelete={() => onDeleteCondition(condition.id)}
                    onToggleActive={() => onToggleActive(condition.id, !condition.isActive)}
                  />
                ))}
              </AnimatePresence>

              {tierConditions.length === 0 && !isAddingNew && (
                <p className="text-center text-zinc-500 py-4">
                  No conditions defined for this tier yet.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ============================================================================
// Main Page Component
// ============================================================================

const EscalationConditionsPage: React.FC = () => {
  const currentUser = useUser();
  const [conditions, setConditions] = useState<EscalationCondition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [trainingContext, setTrainingContext] = useState<string>('');
  const [showTrainingContext, setShowTrainingContext] = useState(false);

  // Bulk import
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkTier, setBulkTier] = useState<EscalationTier>(EscalationTier.MonitorOnly);
  const [bulkText, setBulkText] = useState('');
  const [bulkParseLoading, setBulkParseLoading] = useState(false);
  const [bulkParseError, setBulkParseError] = useState<string | null>(null);
  const [bulkDrafts, setBulkDrafts] = useState<EscalationConditionInput[]>([]);
  const [bulkCreateLoading, setBulkCreateLoading] = useState(false);
  const [bulkCreateResults, setBulkCreateResults] = useState<
    { index: number; status: 'pending' | 'success' | 'error'; id?: string; error?: string }[]
  >([]);

  // Load conditions on mount
  useEffect(() => {
    const unsubscribe = escalationConditionsService.listenAll(
      (loadedConditions) => {
        setConditions(loadedConditions);
        setIsLoading(false);
        setLoadError(null);
      },
      (error: any) => {
        console.error('Failed to load escalation conditions:', error);
        const msg =
          error?.code === 'permission-denied'
            ? 'Permission denied. Your account may not have admin access to escalation conditions in Firestore rules.'
            : error?.message || 'Failed to load escalation conditions.';
        setLoadError(msg);
        setIsLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Filter conditions by search
  const filteredConditions = conditions.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.title.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      c.keywords.some(kw => kw.toLowerCase().includes(q)) ||
      c.examplePhrases.some(p => p.toLowerCase().includes(q))
    );
  });

  // CRUD handlers
  const handleCreateCondition = async (tier: EscalationTier, input: EscalationConditionInput) => {
    if (!currentUser?.id) return;
    await escalationConditionsService.create(input, currentUser.id);
  };

  const handleUpdateCondition = async (id: string, input: Partial<EscalationConditionInput>) => {
    await escalationConditionsService.update(id, input);
  };

  const handleDeleteCondition = async (id: string) => {
    if (!confirm('Are you sure you want to delete this condition?')) return;
    await escalationConditionsService.delete(id);
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    await escalationConditionsService.toggleActive(id, isActive);
  };

  // Generate training context
  const handleGenerateTrainingContext = async () => {
    const context = await escalationConditionsService.buildTrainingContext();
    setTrainingContext(context);
    setShowTrainingContext(true);
  };

  const copyTrainingContext = () => {
    navigator.clipboard.writeText(trainingContext);
  };

  const bulkTemplateForTier = (tier: EscalationTier) => {
    const tc = tierConfig.find((t) => t.tier === tier);
    const categoryList = (tc?.categories || []).join(', ');
    return `# Bulk Import Template (v1)
# Tier is selected in the UI. Categories must map to one of:
# ${categoryList}
#
# Use ONE condition per line:
# - Title: description
#
# Example:
- Performance Anxiety: Acute nerves before competition; intrusive worry about performance, but no safety risk.
- Confidence Dip: Self-doubt and fear of judgment affecting training readiness.
- Overthinking/Rumination: Replaying mistakes, perfectionism, can't shut off the inner critic.
`;
  };

  const resetBulkImportState = () => {
    setBulkText('');
    setBulkParseError(null);
    setBulkDrafts([]);
    setBulkCreateResults([]);
    setBulkParseLoading(false);
    setBulkCreateLoading(false);
  };

  const handleOpenBulkImport = () => {
    setShowBulkImport(true);
    setBulkParseError(null);
    setBulkDrafts([]);
    setBulkCreateResults([]);
    if (!bulkText.trim()) {
      setBulkText(bulkTemplateForTier(bulkTier));
    }
  };

  const handleParseBulk = async () => {
    setBulkParseLoading(true);
    setBulkParseError(null);
    setBulkDrafts([]);
    try {
      const tc = tierConfig.find((t) => t.tier === bulkTier);
      const allowedCategories = (tc?.categories || []) as EscalationCategory[];
      const resp = await fetch('/.netlify/functions/parse-escalation-conditions-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier: bulkTier,
          allowedCategories,
          template: 'v1',
          text: bulkText
        })
      });
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        throw new Error(`Parse failed: ${resp.status} ${txt}`);
      }
      const data = await resp.json();
      if (!Array.isArray(data?.conditions)) {
        throw new Error('Parse failed: invalid response format');
      }
      setBulkDrafts(data.conditions as EscalationConditionInput[]);
      if (data?.warning) {
        // non-fatal
        console.warn('[bulk-import] warning:', data.warning);
      }
    } catch (e: any) {
      setBulkParseError(e?.message || 'Failed to parse bulk conditions.');
    } finally {
      setBulkParseLoading(false);
    }
  };

  const updateBulkDraft = (index: number, patch: Partial<EscalationConditionInput>) => {
    setBulkDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  };

  const handleCreateBulk = async () => {
    if (!currentUser?.id) return;
    if (!bulkDrafts.length) return;

    setBulkCreateLoading(true);
    setBulkCreateResults(bulkDrafts.map((_, i) => ({ index: i, status: 'pending' as const })));
    try {
      const results = await Promise.all(
        bulkDrafts.map(async (draft, i) => {
          try {
            // Strict tier bucketing: force selected tier
            const input: EscalationConditionInput = {
              ...draft,
              tier: bulkTier,
              title: (draft.title || '').trim(),
              description: (draft.description || '').trim(),
              category: draft.category,
              priority: Math.max(0, Math.min(10, Number(draft.priority ?? 0) || 0)),
              isActive: draft.isActive ?? true,
              keywords: (draft.keywords || []).map((s) => (s || '').trim()).filter(Boolean),
              examplePhrases: (draft.examplePhrases || []).map((s) => (s || '').trim()).filter(Boolean),
            };
            const id = await escalationConditionsService.create(input, currentUser.id);
            return { index: i, status: 'success' as const, id };
          } catch (e: any) {
            return {
              index: i,
              status: 'error' as const,
              error: e?.message || String(e || 'Unknown error')
            };
          }
        })
      );

      setBulkCreateResults(results);
    } finally {
      setBulkCreateLoading(false);
    }
  };

  return (
    <AdminRouteGuard>
      <Head>
        <title>PulseCheck Escalation Conditions - Admin</title>
      </Head>

      <div className="min-h-screen bg-[#111417] text-white py-10 px-4">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl font-bold">PulseCheck Escalation Conditions</h1>
            </div>
            <p className="text-zinc-400">
              Define conditions for each escalation tier. The AI uses these examples and keywords
              to determine when to escalate conversations to clinical support.
            </p>
          </div>

          {/* Search & Actions */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search conditions..."
                className="w-full pl-9 pr-4 py-2 rounded-lg bg-[#1a1e24] border border-zinc-700 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#d7ff00]/30 focus:border-[#d7ff00]/40"
              />
            </div>
            <button
              onClick={handleOpenBulkImport}
              className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors flex items-center gap-2"
              title="Paste a batch of conditions using the template, have AI parse and map categories, then create all."
            >
              <Upload className="w-4 h-4" />
              Bulk Import
            </button>
            <button
              onClick={handleGenerateTrainingContext}
              className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors flex items-center gap-2"
            >
              <Copy className="w-4 h-4" />
              Export AI Training Context
            </button>
          </div>

          {/* Load Error */}
          {loadError && (
            <div className="mb-6 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-200">
              <div className="flex items-start gap-3">
                <AlertOctagon className="w-5 h-5 text-red-300 mt-0.5" />
                <div>
                  <div className="font-semibold">Failed to load conditions</div>
                  <div className="text-sm text-red-200/90 mt-1">{loadError}</div>
                  <div className="text-xs text-red-200/70 mt-2">
                    If this is a production site, ensure Firestore rules include admin access for
                    <code className="mx-1 px-1 py-0.5 rounded bg-black/30">escalation-conditions</code>.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {tierConfig.map((tc) => {
              const count = conditions.filter(c => c.tier === tc.tier).length;
              const activeCount = conditions.filter(c => c.tier === tc.tier && c.isActive).length;
              const color = getTierColor(tc.tier);
              return (
                <div
                  key={tc.tier}
                  className="bg-[#1a1e24] rounded-xl p-4 border border-zinc-800"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: color.bg, color: color.text }}
                    >
                      {tc.icon}
                    </div>
                    <span className="text-sm font-medium text-zinc-400">
                      {getTierLabel(tc.tier)}
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {activeCount} <span className="text-sm font-normal text-zinc-500">/ {count}</span>
                  </div>
                  <p className="text-xs text-zinc-500">active conditions</p>
                </div>
              );
            })}
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="text-center py-12">
              <div className="animate-spin w-8 h-8 border-2 border-[#d7ff00] border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-zinc-400">Loading conditions...</p>
            </div>
          )}

          {/* Tier Sections */}
          {!isLoading && (
            <div className="space-y-6">
              {tierConfig.map((tc) => (
                <TierSection
                  key={tc.tier}
                  config={tc}
                  conditions={filteredConditions}
                  onCreateCondition={handleCreateCondition}
                  onUpdateCondition={handleUpdateCondition}
                  onDeleteCondition={handleDeleteCondition}
                  onToggleActive={handleToggleActive}
                />
              ))}
            </div>
          )}

          {/* Training Context Modal */}
          <AnimatePresence>
            {showTrainingContext && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
                onClick={() => setShowTrainingContext(false)}
              >
                <motion.div
                  initial={{ scale: 0.95 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0.95 }}
                  className="bg-[#1a1e24] rounded-xl w-full max-w-3xl max-h-[80vh] overflow-hidden shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between p-4 border-b border-zinc-700">
                    <h3 className="text-lg font-semibold text-white">AI Training Context</h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={copyTrainingContext}
                        className="px-3 py-1.5 rounded-lg bg-[#d7ff00] text-black text-sm font-medium hover:bg-[#d7ff00]/90 transition-colors flex items-center gap-1"
                      >
                        <Copy className="w-3.5 h-3.5" /> Copy
                      </button>
                      <button
                        onClick={() => setShowTrainingContext(false)}
                        className="p-1.5 rounded-lg hover:bg-zinc-700/50 text-zinc-400 hover:text-white transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="p-4 overflow-y-auto max-h-[60vh]">
                    <pre className="text-sm text-zinc-300 whitespace-pre-wrap font-mono bg-zinc-900/50 rounded-lg p-4">
                      {trainingContext}
                    </pre>
                  </div>
                  <div className="p-4 border-t border-zinc-700 bg-zinc-900/30">
                    <p className="text-sm text-zinc-500">
                      This context is used in the PulseCheck AI system prompt to help classify
                      messages and determine escalation decisions.
                    </p>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bulk Import Modal */}
          <AnimatePresence>
            {showBulkImport && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
                onClick={() => {
                  setShowBulkImport(false);
                  resetBulkImportState();
                }}
              >
                <motion.div
                  initial={{ scale: 0.95 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0.95 }}
                  className="bg-[#1a1e24] rounded-xl w-full max-w-4xl max-h-[85vh] overflow-hidden shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between p-4 border-b border-zinc-700">
                    <div>
                      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Upload className="w-5 h-5 text-[#d7ff00]" />
                        Bulk Import Conditions
                      </h3>
                      <p className="text-sm text-zinc-500 mt-1">
                        Use the template. You select the tier; parsing is strict to that tier.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setShowBulkImport(false);
                        resetBulkImportState();
                      }}
                      className="p-1.5 rounded-lg hover:bg-zinc-700/50 text-zinc-400 hover:text-white transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="p-4 overflow-y-auto max-h-[70vh] space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="md:col-span-1">
                        <label className="block text-sm font-medium text-zinc-400 mb-1">Tier</label>
                        <select
                          value={bulkTier}
                          onChange={(e) => {
                            const t = Number(e.target.value) as EscalationTier;
                            setBulkTier(t);
                            // keep user's text, but if empty, load template for tier
                            if (!bulkText.trim()) setBulkText(bulkTemplateForTier(t));
                          }}
                          className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-[#d7ff00]/30 focus:border-[#d7ff00]/40"
                        >
                          <option value={EscalationTier.MonitorOnly}>Tier 1: Monitor Only</option>
                          <option value={EscalationTier.ElevatedRisk}>Tier 2: Elevated Risk</option>
                          <option value={EscalationTier.CriticalRisk}>Tier 3: Critical Risk</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-zinc-400 mb-1">Template (paste batch)</label>
                        <textarea
                          value={bulkText}
                          onChange={(e) => setBulkText(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white focus:outline-none focus:ring-2 focus:ring-[#d7ff00]/30 focus:border-[#d7ff00]/40 min-h-[220px] font-mono text-xs"
                        />
                        <div className="flex items-center justify-between mt-2">
                          <button
                            onClick={() => setBulkText(bulkTemplateForTier(bulkTier))}
                            className="text-xs text-zinc-400 hover:text-white transition-colors"
                          >
                            Reset to template
                          </button>
                          <button
                            onClick={handleParseBulk}
                            disabled={bulkParseLoading || !bulkText.trim()}
                            className="px-3 py-1.5 rounded-lg bg-[#d7ff00] text-black text-sm font-medium hover:bg-[#d7ff00]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                          >
                            {bulkParseLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                            Parse & Preview
                          </button>
                        </div>
                        {bulkParseError && (
                          <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-200 text-sm">
                            {bulkParseError}
                          </div>
                        )}
                      </div>
                    </div>

                    {bulkDrafts.length > 0 && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-semibold text-white">
                              Preview ({bulkDrafts.length})
                            </div>
                            <div className="text-xs text-zinc-500">
                              Edit any field before creating. Tier is forced to the selected tier on create.
                            </div>
                          </div>
                          <button
                            onClick={handleCreateBulk}
                            disabled={bulkCreateLoading}
                            className="px-4 py-2 rounded-lg bg-[#d7ff00] text-black text-sm font-medium hover:bg-[#d7ff00]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                          >
                            {bulkCreateLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                            Create All
                          </button>
                        </div>

                        <div className="space-y-2">
                          {bulkDrafts.map((d, idx) => {
                            const result = bulkCreateResults.find((r) => r.index === idx);
                            return (
                              <div key={idx} className="rounded-xl border border-zinc-700 bg-zinc-900/40 p-3">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="text-sm font-semibold text-white truncate">
                                      {d.title || `Condition ${idx + 1}`}
                                    </div>
                                    <div className="text-xs text-zinc-500">
                                      Category: <span className="text-zinc-300">{d.category}</span> · Priority: {d.priority ?? 0} · Active: {String(d.isActive ?? true)}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {result?.status === 'success' && (
                                      <span className="text-xs text-green-300 flex items-center gap-1">
                                        <CheckCircle2 className="w-4 h-4" /> Created
                                      </span>
                                    )}
                                    {result?.status === 'error' && (
                                      <span className="text-xs text-red-300 flex items-center gap-1">
                                        <AlertOctagon className="w-4 h-4" /> Error
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {result?.status === 'error' && result.error && (
                                  <div className="mt-2 text-xs text-red-200/90">{result.error}</div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
                                  <div>
                                    <label className="block text-xs text-zinc-500 mb-1">Title</label>
                                    <input
                                      value={d.title}
                                      onChange={(e) => updateBulkDraft(idx, { title: e.target.value })}
                                      className="w-full px-2 py-1.5 rounded bg-zinc-950 border border-zinc-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#d7ff00]/20"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-zinc-500 mb-1">Category</label>
                                    <select
                                      value={d.category}
                                      onChange={(e) => updateBulkDraft(idx, { category: e.target.value as EscalationCategory })}
                                      className="w-full px-2 py-1.5 rounded bg-zinc-950 border border-zinc-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#d7ff00]/20"
                                    >
                                      {(tierConfig.find((t) => t.tier === bulkTier)?.categories || []).map((cat) => (
                                        <option key={cat} value={cat}>
                                          {getCategoryLabel(cat)}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="md:col-span-2">
                                    <label className="block text-xs text-zinc-500 mb-1">Description</label>
                                    <textarea
                                      value={d.description}
                                      onChange={(e) => updateBulkDraft(idx, { description: e.target.value })}
                                      className="w-full px-2 py-1.5 rounded bg-zinc-950 border border-zinc-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#d7ff00]/20 min-h-[70px]"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-zinc-500 mb-1">Keywords (comma separated)</label>
                                    <input
                                      value={(d.keywords || []).join(', ')}
                                      onChange={(e) =>
                                        updateBulkDraft(idx, {
                                          keywords: e.target.value
                                            .split(',')
                                            .map((s) => s.trim())
                                            .filter(Boolean)
                                        })
                                      }
                                      className="w-full px-2 py-1.5 rounded bg-zinc-950 border border-zinc-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#d7ff00]/20"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs text-zinc-500 mb-1">Priority (0-10)</label>
                                    <input
                                      type="number"
                                      min={0}
                                      max={10}
                                      value={d.priority ?? 0}
                                      onChange={(e) => updateBulkDraft(idx, { priority: Math.max(0, Math.min(10, Number(e.target.value) || 0)) })}
                                      className="w-full px-2 py-1.5 rounded bg-zinc-950 border border-zinc-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#d7ff00]/20"
                                    />
                                  </div>
                                  <div className="md:col-span-2 flex items-center gap-2">
                                    <input
                                      id={`bulk-active-${idx}`}
                                      type="checkbox"
                                      checked={d.isActive ?? true}
                                      onChange={(e) => updateBulkDraft(idx, { isActive: e.target.checked })}
                                      className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-[#d7ff00] focus:ring-[#d7ff00]/30"
                                    />
                                    <label htmlFor={`bulk-active-${idx}`} className="text-xs text-zinc-400">
                                      Active (used for AI classification)
                                    </label>
                                  </div>
                                  <div className="md:col-span-2">
                                    <label className="block text-xs text-zinc-500 mb-1">Example Phrases (one per line)</label>
                                    <textarea
                                      value={(d.examplePhrases || []).join('\n')}
                                      onChange={(e) =>
                                        updateBulkDraft(idx, {
                                          examplePhrases: e.target.value
                                            .split('\n')
                                            // Do NOT trim+filter here; filtering removes trailing blank lines and prevents Enter creating a new line.
                                            // We sanitize (trim+filter) on Create All instead.
                                            .map((s) => s.replace(/^[-•]\s*/, ''))
                                        })
                                      }
                                      className="w-full px-2 py-1.5 rounded bg-zinc-950 border border-zinc-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#d7ff00]/20 min-h-[70px]"
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-4 border-t border-zinc-700 bg-zinc-900/30 flex items-center justify-between">
                    <div className="text-xs text-zinc-500">
                      Tip: Keep categories exact; AI will map strictly to the selected tier.
                    </div>
                    <button
                      onClick={() => {
                        setShowBulkImport(false);
                        resetBulkImportState();
                      }}
                      className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </AdminRouteGuard>
  );
};

export default EscalationConditionsPage;
