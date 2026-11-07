import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { X, Ruler } from 'lucide-react';

export const SizeGuideModal: React.FC = () => {
  const { isSizeGuideOpen, setIsSizeGuideOpen } = useStore();
  const [activeTab, setActiveTab] = useState<'tops' | 'hoodies' | 'panjabi' | 'bottoms'>('tops');
  const [unit, setUnit] = useState<'in' | 'cm'>('in');

  if (!isSizeGuideOpen) return null;

  const factor = unit === 'in' ? 1 : 2.54;
  const formatVal = (inches: number) => {
    const val = inches * factor;
    return unit === 'in' ? `${val.toFixed(1)}"` : `${Math.round(val)} cm`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#F7F5EF] text-[#202522] w-full max-w-2xl rounded-2xl shadow-2xl border border-[#E5E1D5] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E1D5] bg-white">
          <div className="flex items-center gap-2">
            <Ruler className="w-5 h-5 text-[#FF762E]" />
            <h3 className="text-lg font-bold text-[#14221C] tracking-tight">
              VANTREL Official Size Guide
            </h3>
          </div>
          <button
            onClick={() => setIsSizeGuideOpen(false)}
            className="p-1 rounded-lg text-[#202522]/60 hover:text-[#14221C] hover:bg-[#F7F5EF] transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Category tabs */}
            <div className="flex items-center gap-1 p-1 bg-[#EAE5D8] rounded-xl text-xs font-semibold">
              <button
                onClick={() => setActiveTab('tops')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeTab === 'tops'
                    ? 'bg-[#14221C] text-white shadow-sm'
                    : 'text-[#202522]/70 hover:text-[#14221C]'
                }`}
              >
                T-Shirts & Polos
              </button>
              <button
                onClick={() => setActiveTab('hoodies')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeTab === 'hoodies'
                    ? 'bg-[#14221C] text-white shadow-sm'
                    : 'text-[#202522]/70 hover:text-[#14221C]'
                }`}
              >
                Heavy Hoodies
              </button>
              <button
                onClick={() => setActiveTab('panjabi')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeTab === 'panjabi'
                    ? 'bg-[#14221C] text-white shadow-sm'
                    : 'text-[#202522]/70 hover:text-[#14221C]'
                }`}
              >
                Panjabi & Shirts
              </button>
              <button
                onClick={() => setActiveTab('bottoms')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  activeTab === 'bottoms'
                    ? 'bg-[#14221C] text-white shadow-sm'
                    : 'text-[#202522]/70 hover:text-[#14221C]'
                }`}
              >
                Jeans & Cargo
              </button>
            </div>

            {/* Unit toggle */}
            <div className="flex items-center gap-1 p-1 bg-white border border-[#E5E1D5] rounded-lg text-xs font-medium">
              <button
                onClick={() => setUnit('in')}
                className={`px-2.5 py-1 rounded transition-colors ${
                  unit === 'in' ? 'bg-[#14221C] text-white' : 'text-[#202522]/60 hover:text-[#202522]'
                }`}
              >
                Inches
              </button>
              <button
                onClick={() => setUnit('cm')}
                className={`px-2.5 py-1 rounded transition-colors ${
                  unit === 'cm' ? 'bg-[#14221C] text-white' : 'text-[#202522]/60 hover:text-[#202522]'
                }`}
              >
                CM
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-[#E5E1D5] overflow-hidden">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-[#14221C] text-white text-xs uppercase tracking-wider font-semibold">
                {activeTab === 'tops' && (
                  <tr>
                    <th className="px-4 py-3">Size</th>
                    <th className="px-4 py-3">Chest (Width)</th>
                    <th className="px-4 py-3">Body Length</th>
                    <th className="px-4 py-3">Shoulder</th>
                    <th className="px-4 py-3">Fit Advice</th>
                  </tr>
                )}
                {activeTab === 'hoodies' && (
                  <tr>
                    <th className="px-4 py-3">Size</th>
                    <th className="px-4 py-3">Chest</th>
                    <th className="px-4 py-3">Length</th>
                    <th className="px-4 py-3">Sleeve</th>
                    <th className="px-4 py-3">Silhouette</th>
                  </tr>
                )}
                {activeTab === 'panjabi' && (
                  <tr>
                    <th className="px-4 py-3">Size</th>
                    <th className="px-4 py-3">Chest</th>
                    <th className="px-4 py-3">Length</th>
                    <th className="px-4 py-3">Sleeve</th>
                    <th className="px-4 py-3">Fit</th>
                  </tr>
                )}
                {activeTab === 'bottoms' && (
                  <tr>
                    <th className="px-4 py-3">Size</th>
                    <th className="px-4 py-3">Waist (Inseam)</th>
                    <th className="px-4 py-3">Thigh</th>
                    <th className="px-4 py-3">Leg Opening</th>
                    <th className="px-4 py-3">Silhouette</th>
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-[#E5E1D5] tabular-nums">
                {activeTab === 'tops' && (
                  <>
                    <tr className="hover:bg-[#F7F5EF] transition-colors">
                      <td className="px-4 py-3 font-bold text-[#14221C]">M</td>
                      <td className="px-4 py-3">{formatVal(42)}</td>
                      <td className="px-4 py-3">{formatVal(29)}</td>
                      <td className="px-4 py-3">{formatVal(20.5)}</td>
                      <td className="px-4 py-3 text-[#202522]/70 font-sans">Boxy relaxed</td>
                    </tr>
                    <tr className="hover:bg-[#F7F5EF] transition-colors">
                      <td className="px-4 py-3 font-bold text-[#14221C]">L</td>
                      <td className="px-4 py-3">{formatVal(44)}</td>
                      <td className="px-4 py-3">{formatVal(30)}</td>
                      <td className="px-4 py-3">{formatVal(21.5)}</td>
                      <td className="px-4 py-3 text-[#202522]/70 font-sans">Oversized drape</td>
                    </tr>
                    <tr className="hover:bg-[#F7F5EF] transition-colors">
                      <td className="px-4 py-3 font-bold text-[#14221C]">XL</td>
                      <td className="px-4 py-3">{formatVal(46)}</td>
                      <td className="px-4 py-3">{formatVal(31)}</td>
                      <td className="px-4 py-3">{formatVal(22.5)}</td>
                      <td className="px-4 py-3 text-[#202522]/70 font-sans">Full streetwear</td>
                    </tr>
                    <tr className="hover:bg-[#F7F5EF] transition-colors">
                      <td className="px-4 py-3 font-bold text-[#14221C]">XXL</td>
                      <td className="px-4 py-3">{formatVal(48)}</td>
                      <td className="px-4 py-3">{formatVal(32)}</td>
                      <td className="px-4 py-3">{formatVal(23.5)}</td>
                      <td className="px-4 py-3 text-[#202522]/70 font-sans">Extra roomy fit</td>
                    </tr>
                  </>
                )}

                {activeTab === 'hoodies' && (
                  <>
                    <tr className="hover:bg-[#F7F5EF] transition-colors">
                      <td className="px-4 py-3 font-bold text-[#14221C]">M</td>
                      <td className="px-4 py-3">{formatVal(46)}</td>
                      <td className="px-4 py-3">{formatVal(28.5)}</td>
                      <td className="px-4 py-3">{formatVal(24.5)}</td>
                      <td className="px-4 py-3 text-[#202522]/70 font-sans">Architectural Loose</td>
                    </tr>
                    <tr className="hover:bg-[#F7F5EF] transition-colors">
                      <td className="px-4 py-3 font-bold text-[#14221C]">L</td>
                      <td className="px-4 py-3">{formatVal(48)}</td>
                      <td className="px-4 py-3">{formatVal(29.5)}</td>
                      <td className="px-4 py-3">{formatVal(25)}</td>
                      <td className="px-4 py-3 text-[#202522]/70 font-sans">Heavy Oversize</td>
                    </tr>
                    <tr className="hover:bg-[#F7F5EF] transition-colors">
                      <td className="px-4 py-3 font-bold text-[#14221C]">XL</td>
                      <td className="px-4 py-3">{formatVal(50)}</td>
                      <td className="px-4 py-3">{formatVal(30.5)}</td>
                      <td className="px-4 py-3">{formatVal(25.5)}</td>
                      <td className="px-4 py-3 text-[#202522]/70 font-sans">Streetwear Statement</td>
                    </tr>
                    <tr className="hover:bg-[#F7F5EF] transition-colors">
                      <td className="px-4 py-3 font-bold text-[#14221C]">XXL</td>
                      <td className="px-4 py-3">{formatVal(52)}</td>
                      <td className="px-4 py-3">{formatVal(31.5)}</td>
                      <td className="px-4 py-3">{formatVal(26)}</td>
                      <td className="px-4 py-3 text-[#202522]/70 font-sans">Maximum Silhouette</td>
                    </tr>
                  </>
                )}

                {activeTab === 'panjabi' && (
                  <>
                    <tr className="hover:bg-[#F7F5EF] transition-colors">
                      <td className="px-4 py-3 font-bold text-[#14221C]">M</td>
                      <td className="px-4 py-3">{formatVal(42)}</td>
                      <td className="px-4 py-3">{formatVal(42)}</td>
                      <td className="px-4 py-3">{formatVal(25)}</td>
                      <td className="px-4 py-3 text-[#202522]/70 font-sans">Regular fit</td>
                    </tr>
                    <tr className="hover:bg-[#F7F5EF] transition-colors">
                      <td className="px-4 py-3 font-bold text-[#14221C]">L</td>
                      <td className="px-4 py-3">{formatVal(44)}</td>
                      <td className="px-4 py-3">{formatVal(44)}</td>
                      <td className="px-4 py-3">{formatVal(25.5)}</td>
                      <td className="px-4 py-3 text-[#202522]/70 font-sans">Comfort festive</td>
                    </tr>
                    <tr className="hover:bg-[#F7F5EF] transition-colors">
                      <td className="px-4 py-3 font-bold text-[#14221C]">XL</td>
                      <td className="px-4 py-3">{formatVal(46)}</td>
                      <td className="px-4 py-3">{formatVal(45)}</td>
                      <td className="px-4 py-3">{formatVal(26)}</td>
                      <td className="px-4 py-3 text-[#202522]/70 font-sans">Relaxed drape</td>
                    </tr>
                    <tr className="hover:bg-[#F7F5EF] transition-colors">
                      <td className="px-4 py-3 font-bold text-[#14221C]">XXL</td>
                      <td className="px-4 py-3">{formatVal(48)}</td>
                      <td className="px-4 py-3">{formatVal(46)}</td>
                      <td className="px-4 py-3">{formatVal(26.5)}</td>
                      <td className="px-4 py-3 text-[#202522]/70 font-sans">Grand loose fit</td>
                    </tr>
                  </>
                )}

                {activeTab === 'bottoms' && (
                  <>
                    <tr className="hover:bg-[#F7F5EF] transition-colors">
                      <td className="px-4 py-3 font-bold text-[#14221C]">28</td>
                      <td className="px-4 py-3">{formatVal(28)}</td>
                      <td className="px-4 py-3">{formatVal(23)}</td>
                      <td className="px-4 py-3">{formatVal(15.5)}</td>
                      <td className="px-4 py-3 text-[#202522]/70 font-sans">Slim tailored (28" waist)</td>
                    </tr>
                    <tr className="hover:bg-[#F7F5EF] transition-colors">
                      <td className="px-4 py-3 font-bold text-[#14221C]">30</td>
                      <td className="px-4 py-3">{formatVal(30)}</td>
                      <td className="px-4 py-3">{formatVal(24)}</td>
                      <td className="px-4 py-3">{formatVal(16)}</td>
                      <td className="px-4 py-3 text-[#202522]/70 font-sans">Relaxed straight (30" waist)</td>
                    </tr>
                    <tr className="hover:bg-[#F7F5EF] transition-colors">
                      <td className="px-4 py-3 font-bold text-[#14221C]">32</td>
                      <td className="px-4 py-3">{formatVal(32)}</td>
                      <td className="px-4 py-3">{formatVal(25)}</td>
                      <td className="px-4 py-3">{formatVal(16.5)}</td>
                      <td className="px-4 py-3 text-[#202522]/70 font-sans">Straight utility (32" waist)</td>
                    </tr>
                    <tr className="hover:bg-[#F7F5EF] transition-colors">
                      <td className="px-4 py-3 font-bold text-[#14221C]">34</td>
                      <td className="px-4 py-3">{formatVal(34)}</td>
                      <td className="px-4 py-3">{formatVal(26)}</td>
                      <td className="px-4 py-3">{formatVal(17)}</td>
                      <td className="px-4 py-3 text-[#202522]/70 font-sans">Roomy cut (34" waist)</td>
                    </tr>
                    <tr className="hover:bg-[#F7F5EF] transition-colors">
                      <td className="px-4 py-3 font-bold text-[#14221C]">36</td>
                      <td className="px-4 py-3">{formatVal(36)}</td>
                      <td className="px-4 py-3">{formatVal(27)}</td>
                      <td className="px-4 py-3">{formatVal(18)}</td>
                      <td className="px-4 py-3 text-[#202522]/70 font-sans">Wide relaxed (36" waist)</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>

          {/* Advice note */}
          <div className="bg-white p-4 rounded-xl border border-[#E5E1D5] text-xs text-[#202522]/80 space-y-2">
            <h5 className="font-semibold text-[#14221C]">Measuring Advice:</h5>
            <p>
              • <strong>Chest Width:</strong> Measure 1 inch below armholes straight across the garment chest.
            </p>
            <p>
              • <strong>Body Length:</strong> Measure from the highest point of the shoulder seam down to the bottom hemline.
            </p>
            <p>
              • <strong>Need an exchange?</strong> We offer a 7-day size replacement guarantee anywhere in Bangladesh with doorstep pickup in Dhaka.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-white border-t border-[#E5E1D5] flex justify-end">
          <button
            onClick={() => setIsSizeGuideOpen(false)}
            className="px-5 py-2 text-xs font-semibold uppercase tracking-wider text-white bg-[#14221C] rounded-lg hover:bg-[#202522] transition-colors"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
