import { useEffect, useMemo, useState } from "react";
import { useApp } from "../../context/AppContext";
import {
  fetchKnowledgeEntries,
  getKnowledgeCategoryLabel,
} from "../../services/knowledgeEntryService";

export const TermsAndPolicy = () => {
  const { lang } = useApp();
  const [groups, setGroups] = useState([]);
  const [activeCategory, setActiveCategory] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        setErrorMsg("");
        const data = await fetchKnowledgeEntries();
        setGroups(data);
        setActiveCategory((prev) =>
          data.some((group) => group.category === prev) ? prev : data[0]?.category || ""
        );
      } catch (error) {
        console.error(error);
        setErrorMsg(
          lang === "VN"
            ? "Không tải được nội dung Điều khoản & Chính sách."
            : "Failed to load Terms & Policy content."
        );
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [lang]);

  const activeGroup = useMemo(
    () => groups.find((group) => group.category === activeCategory) || groups[0],
    [groups, activeCategory]
  );

  return (
    <main className="pt-28 pb-20 bg-slate-50 dark:bg-slate-900 min-h-screen transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <div className="flex flex-col items-center text-center mb-16 space-y-4">
          <p className="text-sm font-bold uppercase tracking-widest text-yellow-500 dark:text-yellow-400">
            {lang === "VN" ? "Thông tin pháp lý" : "Legal Information"}
          </p>
          <h1 className="text-4xl md:text-5xl font-headline font-bold text-[#124757] dark:text-white">
            {lang === "VN" ? "Điều khoản & Chính sách" : "Terms & Policy"}
          </h1>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 border-4 border-slate-200 border-t-[#124757] dark:border-t-yellow-400 rounded-full animate-spin" />
          </div>
        ) : groups.length === 0 ? (
          <p className="text-center text-slate-400 py-16 font-medium">
            {errorMsg ||
              (lang === "VN" ? "Chưa có nội dung công khai." : "No public content yet.")}
          </p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            <aside className="lg:col-span-3">
              <nav className="flex lg:flex-col gap-2 overflow-x-auto pb-2 lg:pb-0 lg:sticky lg:top-28">
                {groups.map((group) => (
                  <button
                    key={group.category}
                    type="button"
                    onClick={() => setActiveCategory(group.category)}
                    className={`flex items-center gap-3 shrink-0 lg:w-full text-left px-4 py-3 rounded-2xl font-semibold transition-colors ${
                      activeGroup?.category === group.category
                        ? "bg-[#124757] text-white dark:bg-yellow-400 dark:text-[#124757]"
                        : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                    }`}
                  >
                    {getKnowledgeCategoryLabel(group.category, lang)}
                  </button>
                ))}
              </nav>
            </aside>

            <section className="lg:col-span-9 space-y-8">
              {(activeGroup?.entries || []).map((entry) => (
                <article
                  key={entry.knowledgeEntryId}
                  className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700 p-8"
                >
                  <h2 className="text-xl md:text-2xl font-headline font-bold text-[#124757] dark:text-white mb-4">
                    {entry.title}
                  </h2>
                  <p className="text-sm md:text-base text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line font-body">
                    {entry.content}
                  </p>
                </article>
              ))}
            </section>
          </div>
        )}
      </div>
    </main>
  );
};
