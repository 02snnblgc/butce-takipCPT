export const DEFAULT_CATEGORIES = {
  income: [
    'Maaş',
    'Ek Gelir',
    'Kira Geliri',
    'Türkiye Finanstan Çekilen'
  ],
  expense: [
    'Ziraat Bankası Troy',
    'Ziraat Bankası M.Card',
    'Halk Bankası Troy',
    'Halk Bankası M.Card',
    'Türkiye Finans',
    'Elektrik Faturası',
    'Su Faturası',
    'Doğal gaz Faturası',
    'Sıcak Su Doğal gaz Faturası',
    'İnternet Faturası',
    'Site Aidatı',
    'Sabiha Telefon Faturası',
    'Sinan Telefon Faturası',
    'Hüda Nur Telefon Faturası',
    'Hüda Nur Aylık',
    'Sabihaya',
    'Sinana',
    'Traş İçin',
    'İş Yeri Yemek',
    'İş Yeri Çay',
    'İş Yeri Su',
    'Araç Sigortası',
    'Araç Muayenesi',
    'Araç Bakımı',
    'Araç Lastiği',
    'Kira / Konut',
    'Mutfak & Market',
    'Eğitim & Kurs',
    'Sağlık & Bakım',
    'Diğer'
  ]
};

export function categoriesFor(type, custom = {}) {
  const defaults = DEFAULT_CATEGORIES[type] || [];
  const extras = custom[type] || [];
  return [...new Set([...defaults, ...extras])].sort((a, b) => {
    const ai = defaults.indexOf(a);
    const bi = defaults.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b, 'tr');
  });
}
