const theme = {
  spacing: { xxs: 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32, xxl: 40 },
  radius: { sm: 10, md: 16, lg: 24, xl: 30, pill: 999 },
  type: {
    display: { fontSize: 30, lineHeight: 37, fontWeight: '800' },
    title: { fontSize: 22, lineHeight: 29, fontWeight: '800' },
    section: { fontSize: 18, lineHeight: 24, fontWeight: '700' },
    body: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
    label: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
    caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  },
  layout: { pageMaxWidth: 1080, contentMaxWidth: 720, pageGutter: 20, touchTarget: 46 },
  motion: { fast: 140, base: 240, slow: 420 },
  shadow: {
    soft: {
      shadowColor: '#5A3620',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 14,
      elevation: 3,
    },
    lifted: {
      shadowColor: '#5A3620',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.16,
      shadowRadius: 22,
      elevation: 7,
    },
    gold: {
      shadowColor: '#D9A441',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.28,
      shadowRadius: 16,
      elevation: 5,
    },
  },
};

export default theme;
