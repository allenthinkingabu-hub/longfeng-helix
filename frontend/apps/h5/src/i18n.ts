// i18n stub for SC-01 · full i18n setup lands later
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

export const i18n = i18next.createInstance();
i18n.use(initReactI18next).init({
  lng: 'zh',
  fallbackLng: 'zh',
  resources: { zh: { translation: {} } },
  interpolation: { escapeValue: false },
});
