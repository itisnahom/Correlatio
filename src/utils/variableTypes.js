// All available variable types with icons and units
export const VARIABLE_TYPES = [
  { id: 'hours',     icon: '⏱️',  label: 'Hours',      unit: 'hrs',     placeholder: 'e.g. Hours of sleep' },
  { id: 'boolean',   icon: '✔️',  label: 'Yes/No',     unit: 'bool',    placeholder: 'e.g. Meditated?' },
  { id: 'cups',      icon: '☕',  label: 'Cups',       unit: 'cups',    placeholder: 'e.g. Cups of coffee' },
  { id: 'rating',    icon: '⭐',  label: 'Rating',     unit: '/10',     placeholder: 'e.g. Mood rating' },
  { id: 'pages',     icon: '📖',  label: 'Pages',      unit: 'pages',   placeholder: 'e.g. Pages read' },
  { id: 'tasks',     icon: '✅',  label: 'Tasks',      unit: 'tasks',   placeholder: 'e.g. Tasks completed' },
  { id: 'minutes',   icon: '⏰',  label: 'Minutes',    unit: 'min',     placeholder: 'e.g. Meditation time' },
  { id: 'steps',     icon: '🚶',  label: 'Steps',      unit: 'k steps', placeholder: 'e.g. Steps walked' },
  { id: 'dollars',   icon: '💰',  label: 'Money',      unit: '$',       placeholder: 'e.g. Money spent' },
  { id: 'calories',  icon: '🍎',  label: 'Calories',   unit: 'kcal',    placeholder: 'e.g. Calories eaten' },
  { id: 'glasses',   icon: '💧',  label: 'Glasses',    unit: 'glasses', placeholder: 'e.g. Glasses of water' },
  { id: 'workouts',  icon: '🏋️', label: 'Sessions',   unit: 'sessions',placeholder: 'e.g. Workout sessions' },
  { id: 'percent',   icon: '📊',  label: 'Percent',    unit: '%',       placeholder: 'e.g. Battery level' },
  { id: 'score',     icon: '🎯',  label: 'Score',      unit: '%',       placeholder: 'e.g. Test score' },
  { id: 'count',     icon: '🔢',  label: 'Count',      unit: 'times',   placeholder: 'e.g. Times checked phone' },
  { id: 'weight',    icon: '⚖️',  label: 'Weight',     unit: 'kg',      placeholder: 'e.g. Body weight' },
  { id: 'km',        icon: '🏃',  label: 'Distance',   unit: 'km',      placeholder: 'e.g. Distance run' },
  { id: 'hours_foc', icon: '🧠',  label: 'Focus',      unit: 'hrs',     placeholder: 'e.g. Deep focus hours' },
  { id: 'sleep_q',   icon: '😴',  label: 'Sleep Qual', unit: '/10',     placeholder: 'e.g. Sleep quality' },
  { id: 'social',    icon: '📱',  label: 'Screen',     unit: 'hrs',     placeholder: 'e.g. Social media time' },
  { id: 'custom',    icon: '✏️',  label: 'Custom',     unit: '',        placeholder: 'Name your variable' },
];

export const getVarType = (id) => VARIABLE_TYPES.find(v => v.id === id) ?? VARIABLE_TYPES[VARIABLE_TYPES.length - 1];
