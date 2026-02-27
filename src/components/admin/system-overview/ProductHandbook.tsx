import React from 'react';
import type { FeatureSpec, ProductHandbook as ProductHandbookType } from '../../../content/system-overview/schema';

const STATUS_STYLES: Record<FeatureSpec['status'], string> = {
  active: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
  beta: 'bg-amber-500/20 text-amber-300 border-amber-400/30',
  planned: 'bg-sky-500/20 text-sky-300 border-sky-400/30',
  deprecated: 'bg-rose-500/20 text-rose-300 border-rose-400/30',
};

interface ProductHandbookProps {
  product: ProductHandbookType;
}

function StatusBadge({ status }: { status: FeatureSpec['status'] }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  );
}

const ProductHandbook: React.FC<ProductHandbookProps> = ({ product }) => {
  return (
    <article id={`product-${product.id}`} className="bg-[#090f1c] border border-zinc-800 rounded-2xl p-5 space-y-5 min-w-0">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-2xl font-semibold text-white">{product.name}</h3>
          <StatusBadge status={product.status} />
        </div>
        <p className="text-sm text-zinc-300">{product.summary}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-zinc-400">
          <p>
            Owner: <span className="text-zinc-200">{product.owner}</span>
          </p>
          <p>
            Repo: <span className="text-zinc-200">{product.repo}</span>
          </p>
          <p>
            Platform: <span className="text-zinc-200">{product.platform}</span>
          </p>
          <p>
            Release Channel: <span className="text-zinc-200">{product.releaseChannel}</span>
          </p>
        </div>
        <div className="text-xs text-zinc-300">
          <p className="uppercase tracking-wide text-zinc-500 mb-1">Key Outcomes</p>
          <ul className="list-disc pl-4 space-y-1">
            {product.keyOutcomes.map((outcome) => (
              <li key={outcome}>{outcome}</li>
            ))}
          </ul>
        </div>
      </header>

      <div className="overflow-x-auto border border-zinc-800 rounded-xl max-w-full">
        <table className="w-full text-xs min-w-[1240px]">
          <thead className="bg-black/20 text-zinc-400 uppercase tracking-wide">
            <tr>
              <th className="text-left px-3 py-2">Feature</th>
              <th className="text-left px-3 py-2">Persona</th>
              <th className="text-left px-3 py-2">Outcome</th>
              <th className="text-left px-3 py-2">Entry Points</th>
              <th className="text-left px-3 py-2">Dependent Services</th>
              <th className="text-left px-3 py-2">Firestore Collections</th>
              <th className="text-left px-3 py-2">Integrations</th>
              <th className="text-left px-3 py-2">Owner</th>
              <th className="text-left px-3 py-2">Release</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Source References</th>
            </tr>
          </thead>
          <tbody>
            {product.featureInventory.map((feature) => (
              <tr key={feature.id} className="border-t border-zinc-800 align-top">
                <td className="px-3 py-3 text-zinc-100 font-semibold">{feature.name}</td>
                <td className="px-3 py-3 text-zinc-300">{feature.persona}</td>
                <td className="px-3 py-3 text-zinc-300">{feature.outcome}</td>
                <td className="px-3 py-3 text-zinc-300">{feature.entryPoints.join(' | ')}</td>
                <td className="px-3 py-3 text-zinc-300">{feature.dependentServices.join(', ')}</td>
                <td className="px-3 py-3 text-zinc-300">{feature.firestoreCollections.join(', ') || 'N/A'}</td>
                <td className="px-3 py-3 text-zinc-300">{feature.integrations.join(', ') || 'N/A'}</td>
                <td className="px-3 py-3 text-zinc-300">{feature.owner}</td>
                <td className="px-3 py-3 text-zinc-300">{feature.releaseChannel}</td>
                <td className="px-3 py-3">
                  <StatusBadge status={feature.status} />
                </td>
                <td className="px-3 py-3 text-zinc-300">
                  <ul className="space-y-1">
                    {feature.sourceRefs.map((ref) => (
                      <li key={`${feature.id}-${ref.path}`}>
                        <span className="text-white">{ref.label}</span>
                        <p className="text-[11px] text-zinc-500 break-all">{ref.path}</p>
                      </li>
                    ))}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
};

export default ProductHandbook;
