module.exports = {
  name: "Claudio Del Valle",
  title: "Claudio Del Valle - Personal Website",
  url: "https://daftclaud.github.io",
  author: "Claudio Del Valle",
  description: "Personal website featuring word curations, pen collection, and insights from Monterrey, Mexico.",
  currentYear: new Date().getFullYear(),
  
  // Localization settings
  defaultLocale: "en",
  supportedLocales: ["en", "es"],
  
  locales: {
    en: {
      label: "English",
      lang: "en-US",
      dir: "ltr",
      path: ""
    },
    es: {
      label: "Español (México)",
      lang: "es-MX",
      dir: "ltr",
      path: "/es"
    }
  }
};
