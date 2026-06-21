import { useState } from 'react';
import { Search, Sparkles } from 'lucide-react';

export function AskAIBar() {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    // Simulate AI response
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mock AI responses based on query
    const lowerQuery = query.toLowerCase();
    let aiResponse = '';
    
    if (lowerQuery.includes('total cattle') || lowerQuery.includes('how many')) {
      if (lowerQuery.includes('san roque')) {
        aiResponse = 'Total cattle in San Roque: 245 heads (as of April 23, 2026). This includes 180 dairy cattle and 65 beef cattle. Recent trend shows 3% increase from last month.';
      } else {
        aiResponse = 'Total cattle in Padre Garcia: 1,234 heads across all barangays. Top 3 barangays: San Roque (245), Banaba Ibaba (198), Quilo-quilo (167).';
      }
    } else if (lowerQuery.includes('disease') || lowerQuery.includes('outbreak')) {
      aiResponse = 'Current disease status: 2 active alerts in Banaba Ibaba (Foot-and-Mouth Disease suspected). Last confirmed outbreak was 3 months ago. Recommend immediate vaccination for all cattle within 5km radius.';
    } else if (lowerQuery.includes('mortality') || lowerQuery.includes('death')) {
      aiResponse = 'Mortality rate for Q1 2026: 1.2% (15 cases). Primary causes: Disease (60%), Old age (25%), Accidents (15%). This is below the regional average of 1.8%.';
    } else if (lowerQuery.includes('production') || lowerQuery.includes('milk')) {
      aiResponse = 'Average milk production: 18.5 liters/day per dairy cattle. Total monthly production: 99,900 liters. Forecast for next month: 102,000 liters (+2.1%).';
    } else {
      aiResponse = 'I found relevant information for your query. The livestock database shows comprehensive data across all barangays. Please refine your question for more specific insights.';
    }
    
    setResponse(aiResponse);
    setLoading(false);
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <form onSubmit={handleSearch} className="relative">
        <div className="flex items-center gap-2 bg-white border-2 border-[#2D5A27] rounded-lg px-4 py-3 shadow-lg">
          <Sparkles className="w-5 h-5 text-[#2D5A27] flex-shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask AI: e.g., 'Total cattle in San Roque' or 'Disease status in Padre Garcia'"
            className="flex-1 outline-none bg-transparent"
          />
          <button
            type="submit"
            className="bg-[#2D5A27] text-white p-2 rounded-lg hover:bg-[#3d7234] transition-colors"
          >
            <Search className="w-5 h-5" />
          </button>
        </div>
      </form>

      {loading && (
        <div className="mt-4 p-4 bg-white border border-gray-200 rounded-lg">
          <div className="flex items-center gap-2 text-gray-600">
            <Sparkles className="w-5 h-5 animate-pulse text-[#2D5A27]" />
            <span>Analyzing data...</span>
          </div>
        </div>
      )}

      {response && !loading && (
        <div className="mt-4 p-4 bg-white border-2 border-[#2D5A27] rounded-lg shadow-md">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-[#2D5A27] flex-shrink-0 mt-1" />
            <div>
              <p className="text-sm text-gray-600 mb-1">AI Response:</p>
              <p className="text-gray-900">{response}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
