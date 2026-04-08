import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

const PAYMENT_METHOD_OPTIONS = [
  'Discover',
  'Amex',
  'Apple Card',
  'Chase',
  'Checking',
  'Cash',
  'Debit',
  'Other',
] as const;

interface ExistingExpenseInput {
  date?: string;
  label?: string;
  amount?: number | string;
  paymentMethod?: string;
  notes?: string;
}

interface ParseExpensesRequest {
  imageUrls?: string[];
  existingExpenses?: ExistingExpenseInput[];
  targetMonth?: number;
  targetYear?: number;
}

interface ParsedExpense {
  date: string;
  label: string;
  amount: number;
  paymentMethod: string;
  notes: string;
}

const normalizePaymentMethod = (value?: string) =>
  PAYMENT_METHOD_OPTIONS.includes((value || 'Other') as (typeof PAYMENT_METHOD_OPTIONS)[number])
    ? (value as string)
    : 'Other';

const sanitizeMoneyValue = (value: number | string | undefined) => {
  const asString = typeof value === 'number' ? String(value) : value || '';
  const parsed = Number.parseFloat(asString.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeExpenseLabel = (value: string) =>
  value
    .toLowerCase()
    .replace(/https?:\/\//g, ' ')
    .replace(/www\./g, ' ')
    .replace(/\b\d{4,}\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const labelsLikelyMatch = (left: string, right: string) => {
  const normalizedLeft = normalizeExpenseLabel(left);
  const normalizedRight = normalizeExpenseLabel(right);

  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight) return true;
  if (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)) return true;

  const leftTokens = normalizedLeft.split(' ').filter((token) => token.length > 2);
  const rightTokens = normalizedRight.split(' ').filter((token) => token.length > 2);
  if (!leftTokens.length || !rightTokens.length) return false;

  const overlapCount = leftTokens.filter((token) => rightTokens.includes(token)).length;
  return overlapCount >= Math.max(1, Math.min(leftTokens.length, rightTokens.length) - 1);
};

const expensesLikelyMatch = (
  left: Pick<ParsedExpense, 'date' | 'label' | 'amount'>,
  right: Pick<ParsedExpense, 'date' | 'label' | 'amount'>
) => {
  if (Math.abs(left.amount - right.amount) > 0.009) return false;
  if (!labelsLikelyMatch(left.label, right.label)) return false;

  if (left.date && right.date) {
    return left.date === right.date;
  }

  return true;
};

const cleanJsonResponse = (value: string) =>
  value
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .replace(/^[^{[]*/, '')
    .replace(/[^}\]]*$/, '')
    .replace(/,(\s*[}\]])/g, '$1')
    .trim();

const parseModelResponse = (value: string) => {
  const cleaned = cleanJsonResponse(value);

  try {
    return JSON.parse(cleaned);
  } catch (_error) {
    const objectMatch = cleaned.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      return JSON.parse(objectMatch[0]);
    }

    throw new Error('AI returned invalid JSON while parsing founder budget screenshot expenses.');
  }
};

const resolveOpenAIApiKey = () => {
  const configuredKey = process.env.OPENAI_API_KEY?.trim() || process.env.OPEN_AI_SECRET_KEY?.trim();
  return configuredKey || null;
};

const normalizeParsedExpense = (value: unknown): ParsedExpense | null => {
  if (!value || typeof value !== 'object') return null;

  const candidate = value as Record<string, unknown>;
  const label = typeof candidate.label === 'string' ? candidate.label.trim() : '';
  const amount = sanitizeMoneyValue(candidate.amount as number | string | undefined);
  if (!label || amount === 0) return null;

  return {
    date: typeof candidate.date === 'string' ? candidate.date : '',
    label,
    amount,
    paymentMethod: normalizePaymentMethod(typeof candidate.paymentMethod === 'string' ? candidate.paymentMethod : undefined),
    notes: typeof candidate.notes === 'string' ? candidate.notes.trim() : '',
  };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const {
      imageUrls = [],
      existingExpenses = [],
      targetMonth,
      targetYear,
    } = (req.body || {}) as ParseExpensesRequest;

    if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
      return res.status(400).json({ error: 'At least one image URL is required.' });
    }

    const apiKey = resolveOpenAIApiKey();
    if (!apiKey) {
      return res.status(500).json({ error: 'OpenAI API key not configured. Expected OPENAI_API_KEY or OPEN_AI_SECRET_KEY.' });
    }

    const openai = new OpenAI({ apiKey });

    const normalizedExistingExpenses: ParsedExpense[] = (Array.isArray(existingExpenses) ? existingExpenses : [])
      .map((expense) => normalizeParsedExpense(expense))
      .filter((expense): expense is ParsedExpense => !!expense);

    const prompt = `You are extracting expense line items from screenshot images for a founder budget dashboard.

Target budget month: ${targetMonth || 'unknown'}
Target budget year: ${targetYear || 'unknown'}

Existing misc expenses already on the month:
${JSON.stringify(normalizedExistingExpenses.slice(0, 250), null, 2)}

Your job:
1. Read the uploaded screenshot images.
2. Extract only actual expense rows that belong in a misc / line-item expense list.
3. Ignore totals, balances, headers, section labels, notes blocks, checkbox columns, and summary metrics.
4. Normalize dates to YYYY-MM-DD when the image shows enough information.
5. If the image shows only month/day but not year, use the target month/year above.
6. If the payment method is visible, map it to one of: ${PAYMENT_METHOD_OPTIONS.join(', ')}. Otherwise use "Other".
7. Set notes to "" unless a short note is genuinely useful.
8. Deduplicate aggressively against the existing misc expenses list. If an expense already exists, do not include it again.
9. Also deduplicate across overlapping screenshots in this same request.

Duplicate guidance:
- Treat rows as duplicates when the merchant/description is the same expense even if OCR punctuation, case, spacing, or long reference digits differ.
- Same label + same amount + same date is a duplicate.
- If date is missing, same label + same amount should usually be treated as a duplicate.

Return JSON only in this exact shape:
{
  "expenses": [
    {
      "date": "YYYY-MM-DD or empty string",
      "label": "Merchant or expense description",
      "amount": 123.45,
      "paymentMethod": "Discover|Amex|Apple Card|Chase|Checking|Cash|Debit|Other",
      "notes": ""
    }
  ],
  "summary": {
    "parsedCount": 0,
    "duplicateCount": 0
  }
}`;

    const imageContent = imageUrls.map((url) => ({
      type: 'image_url' as const,
      image_url: {
        url,
        detail: 'high' as const,
      },
    }));

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.1,
      max_tokens: 2500,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are a precise finance OCR assistant. You extract structured expense rows from screenshots and return strict JSON only.',
        },
        {
          role: 'user',
          content: [{ type: 'text', text: prompt }, ...imageContent],
        },
      ],
    });

    const rawContent = completion.choices?.[0]?.message?.content?.trim();
    if (!rawContent) {
      throw new Error('OpenAI did not return any screenshot extraction content.');
    }

    const parsedContent = parseModelResponse(rawContent) as Record<string, unknown>;
    const parsedExpensesRaw = Array.isArray(parsedContent.expenses) ? parsedContent.expenses : [];
    const normalizedParsedExpenses = parsedExpensesRaw
      .map((expense) => normalizeParsedExpense(expense))
      .filter((expense): expense is ParsedExpense => !!expense);

    const comparisonPool = [...normalizedExistingExpenses];
    const dedupedExpenses: ParsedExpense[] = [];
    let duplicateCount = 0;

    normalizedParsedExpenses.forEach((expense) => {
      const isDuplicate = comparisonPool.some((existingExpense) => expensesLikelyMatch(existingExpense, expense));

      if (isDuplicate) {
        duplicateCount += 1;
        return;
      }

      dedupedExpenses.push(expense);
      comparisonPool.push(expense);
    });

    return res.status(200).json({
      success: true,
      expenses: dedupedExpenses,
      summary: {
        parsedCount: normalizedParsedExpenses.length,
        newCount: dedupedExpenses.length,
        duplicateCount:
          typeof parsedContent.summary === 'object' &&
          parsedContent.summary &&
          typeof (parsedContent.summary as Record<string, unknown>).duplicateCount === 'number'
            ? Math.max(
                duplicateCount,
                (parsedContent.summary as Record<string, number>).duplicateCount
              )
            : duplicateCount,
      },
    });
  } catch (error) {
    console.error('[FounderBudget] Failed to parse screenshot expenses:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to parse founder budget screenshot expenses.',
    });
  }
}
