import React from 'react';
import { useStore } from '../context/StoreContext';
import { X, Check, ShoppingBag, Trash2, ArrowRight, Star, ExternalLink } from 'lucide-react';

export const ProductComparisonModal: React.FC = () => {
  const {
    comparisonList,
    removeFromComparison,
    clearComparison,
    products,
    isComparisonModalOpen,
    setIsComparisonModalOpen,
    openProductDetail,
    addToCart
  } = useStore();

  if (!isComparisonModalOpen) return null;

  const comparedProducts = products.filter((p) => comparisonList.includes(p.id));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-w-6xl max-h-[90vh] rounded-3xl border border-[#E5E1D5] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#E5E1D5] flex items-center justify-between bg-[#F7F5EF]">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#FF762E]">
                Specifications & Fit Matrix
              </span>
              <span className="px-2 py-0.5 bg-[#14221C] text-white text-[10px] font-bold rounded-full">
                {comparedProducts.length}/4 Garments
              </span>
            </div>
            <h2 className="font-heading text-xl sm:text-2xl font-bold text-[#14221C] uppercase tracking-tight">
              Product Comparison
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {comparedProducts.length > 0 && (
              <button
                onClick={clearComparison}
                className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All</span>
              </button>
            )}
            <button
              onClick={() => setIsComparisonModalOpen(false)}
              className="p-2 text-[#202522]/60 hover:text-[#14221C] rounded-xl hover:bg-stone-200/50 transition-colors"
              aria-label="Close Comparison"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-6">
          {comparedProducts.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <ShoppingBag className="w-12 h-12 mx-auto text-[#202522]/20" />
              <h3 className="font-heading text-lg font-bold text-[#14221C]">No Garments Selected</h3>
              <p className="text-xs text-[#202522]/60 max-w-md mx-auto">
                Browse the catalog and click the comparison icon on any product card to inspect fabrics, silhouettes, and sizing side-by-side.
              </p>
              <button
                onClick={() => setIsComparisonModalOpen(false)}
                className="px-6 py-2.5 bg-[#14221C] text-white text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-[#202522] transition-colors"
              >
                Explore Collection
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <tbody>
                  {/* Row 1: Product Header & Image */}
                  <tr className="border-b border-[#E5E1D5]">
                    <td className="p-3 font-bold text-[#14221C] uppercase tracking-wider bg-[#F7F5EF]/60 w-36 align-top">
                      Garment
                    </td>
                    {comparedProducts.map((p) => {
                      const price = p.discountPrice ?? p.regularPrice;
                      return (
                        <td key={p.id} className="p-3 min-w-[220px] max-w-[260px] align-top">
                          <div className="relative group">
                            <button
                              onClick={() => removeFromComparison(p.id)}
                              className="absolute top-2 right-2 z-10 p-1.5 bg-white/90 rounded-full text-[#202522] hover:text-rose-600 shadow-sm transition-all"
                              title="Remove from comparison"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                            <img
                              src={p.images[0]}
                              alt={p.name}
                              className="w-full h-48 object-cover rounded-2xl bg-stone-100 border border-[#E5E1D5] mb-3"
                              referrerPolicy="no-referrer"
                            />
                            <h4 className="font-heading font-bold text-sm text-[#14221C] leading-snug line-clamp-2">
                              {p.name}
                            </h4>
                            <p className="text-[11px] text-[#202522]/60 mt-0.5">{p.category} · {p.subCategory}</p>
                            <div className="mt-2 flex items-baseline gap-2">
                              <span className="text-base font-extrabold text-[#14221C] tabular-nums">
                                ৳{price.toLocaleString()}
                              </span>
                              {p.discountPrice && (
                                <span className="text-xs line-through text-[#202522]/40 tabular-nums">
                                  ৳{p.regularPrice.toLocaleString()}
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => {
                                setIsComparisonModalOpen(false);
                                openProductDetail(p.id);
                              }}
                              className="mt-3 w-full py-2 px-3 bg-[#14221C] hover:bg-[#202522] text-white text-[11px] font-bold uppercase tracking-wider rounded-xl transition-colors flex items-center justify-center gap-1.5"
                            >
                              <span>View Piece</span>
                              <ExternalLink className="w-3 h-3 text-[#FF762E]" />
                            </button>
                          </div>
                        </td>
                      );
                    })}
                  </tr>

                  {/* Row 2: Fabric & Material */}
                  <tr className="border-b border-[#E5E1D5]">
                    <td className="p-3 font-bold text-[#14221C] bg-[#F7F5EF]/60">Fabric Specs</td>
                    {comparedProducts.map((p) => (
                      <td key={p.id} className="p-3 text-[#202522]/80 font-medium">
                        {p.fabric}
                      </td>
                    ))}
                  </tr>

                  {/* Row 3: Fit Silhouette */}
                  <tr className="border-b border-[#E5E1D5]">
                    <td className="p-3 font-bold text-[#14221C] bg-[#F7F5EF]/60">Fit & Cut</td>
                    {comparedProducts.map((p) => (
                      <td key={p.id} className="p-3 text-[#202522]/80">
                        {p.fit}
                      </td>
                    ))}
                  </tr>

                  {/* Row 4: Available Sizes */}
                  <tr className="border-b border-[#E5E1D5]">
                    <td className="p-3 font-bold text-[#14221C] bg-[#F7F5EF]/60">Available Sizes</td>
                    {comparedProducts.map((p) => (
                      <td key={p.id} className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {p.sizes.map((s) => (
                            <span
                              key={s}
                              className="px-2 py-0.5 bg-[#F7F5EF] border border-[#E5E1D5] text-[10px] font-bold rounded"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </td>
                    ))}
                  </tr>

                  {/* Row 5: Colorways */}
                  <tr className="border-b border-[#E5E1D5]">
                    <td className="p-3 font-bold text-[#14221C] bg-[#F7F5EF]/60">Color Options</td>
                    {comparedProducts.map((p) => (
                      <td key={p.id} className="p-3">
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {(p.colors || []).map((c) => (
                            <span
                              key={c.name}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#F7F5EF] border border-[#E5E1D5] rounded text-[10px] text-[#202522]/80"
                            >
                              <span
                                className="w-2.5 h-2.5 rounded-full border border-black/10"
                                style={{ backgroundColor: c.hex }}
                              />
                              <span>{c.name}</span>
                            </span>
                          ))}
                        </div>
                      </td>
                    ))}
                  </tr>

                  {/* Row 6: Inventory Status */}
                  <tr className="border-b border-[#E5E1D5]">
                    <td className="p-3 font-bold text-[#14221C] bg-[#F7F5EF]/60">Stock Status</td>
                    {comparedProducts.map((p) => (
                      <td key={p.id} className="p-3">
                        {p.totalStock > 10 ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-[11px]">
                            <Check className="w-3.5 h-3.5" />
                            <span>In Stock ({p.totalStock} units in Banani)</span>
                          </span>
                        ) : p.totalStock > 0 ? (
                          <span className="text-amber-700 font-bold text-[11px]">
                            Low Stock (Only {p.totalStock} left)
                          </span>
                        ) : (
                          <span className="text-rose-600 font-bold text-[11px]">
                            Sold Out
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* Row 7: Rating & Reviews */}
                  <tr className="border-b border-[#E5E1D5]">
                    <td className="p-3 font-bold text-[#14221C] bg-[#F7F5EF]/60">Rating</td>
                    {comparedProducts.map((p) => (
                      <td key={p.id} className="p-3">
                        <div className="flex items-center gap-1.5">
                          <div className="flex items-center text-amber-400">
                            <Star className="w-3.5 h-3.5 fill-amber-400" />
                          </div>
                          <span className="font-bold text-[#14221C]">{p.rating}</span>
                          <span className="text-[#202522]/50">({p.reviewCount} reviews)</span>
                        </div>
                      </td>
                    ))}
                  </tr>

                  {/* Row 8: Garment Care */}
                  <tr>
                    <td className="p-3 font-bold text-[#14221C] bg-[#F7F5EF]/60 align-top">Care</td>
                    {comparedProducts.map((p) => (
                      <td key={p.id} className="p-3 text-[11px] text-[#202522]/70 align-top space-y-1">
                        {p.care.slice(0, 2).map((c, i) => (
                          <div key={i} className="flex items-start gap-1">
                            <span className="text-[#FF762E]">•</span>
                            <span>{c}</span>
                          </div>
                        ))}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Floating Comparison Dock at bottom of screen
export const FloatingComparisonDock: React.FC = () => {
  const { comparisonList, setIsComparisonModalOpen, products, clearComparison } = useStore();

  if (comparisonList.length === 0) return null;

  const comparedProducts = products.filter((p) => comparisonList.includes(p.id));

  return (
    <div className="fixed bottom-4 right-4 z-40 bg-[#14221C] text-white p-3 rounded-2xl shadow-2xl border border-stone-700/50 flex items-center gap-3 animate-slideUp">
      <div className="flex -space-x-2 overflow-hidden items-center pl-1">
        {comparedProducts.map((p) => (
          <img
            key={p.id}
            src={p.images[0]}
            alt={p.name}
            className="w-10 h-10 rounded-xl object-cover border-2 border-[#14221C]"
            referrerPolicy="no-referrer"
          />
        ))}
      </div>

      <div className="text-left text-xs pr-1">
        <div className="font-bold">Compare ({comparisonList.length}/4)</div>
        <div className="text-[10px] text-stone-300">Garment specs ready</div>
      </div>

      <button
        onClick={() => setIsComparisonModalOpen(true)}
        className="px-3.5 py-1.5 bg-[#FF762E] hover:bg-[#e8631c] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-colors cursor-pointer"
      >
        View
      </button>

      <button
        onClick={clearComparison}
        className="p-1.5 text-stone-400 hover:text-white rounded-lg transition-colors"
        title="Clear comparison"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
