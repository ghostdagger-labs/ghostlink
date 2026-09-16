export function useLandingTheme() {
  const theme = useState<'dark' | 'light'>('landing-theme', () => 'dark');
  const ready = ref(false);
  onMounted(() => { ready.value = true; });
  const toggleTheme = () => { theme.value = theme.value === 'dark' ? 'light' : 'dark'; };
  return { theme, toggleTheme, ready };
}
