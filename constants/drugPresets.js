// Drug presets for common caffeine and alcohol drinks
// Contains typical amounts to auto-fill when users select drink types

export const CAFFEINE_PRESETS = [
  {
    id: 'coffee',
    name: 'Coffee (1 cup)',
    caffeine_mg: 95,
    default_amount: 1,
    unit: 'cups'
  },
  {
    id: 'espresso',
    name: 'Espresso (1 shot)',
    caffeine_mg: 64,
    default_amount: 1,
    unit: 'shots'
  },
  {
    id: 'black_tea',
    name: 'Black Tea (1 cup)',
    caffeine_mg: 47,
    default_amount: 1,
    unit: 'cups'
  },
  {
    id: 'green_tea',
    name: 'Green Tea (1 cup)',
    caffeine_mg: 29,
    default_amount: 1,
    unit: 'cups'
  },
  {
    id: 'energy_drink',
    name: 'Energy Drink (1 can)',
    caffeine_mg: 150, // Average of 80-200mg range
    default_amount: 1,
    unit: 'cans'
  },
  {
    id: 'cola',
    name: 'Cola (12oz)',
    caffeine_mg: 34,
    default_amount: 1,
    unit: 'cans'
  }
];

export const ALCOHOL_PRESETS = [
  {
    id: 'beer',
    name: 'Beer (12oz)',
    alcohol_units: 1, // 1 standard drink
    default_amount: 1,
    unit: 'drinks'
  },
  {
    id: 'wine',
    name: 'Wine (5oz)',
    alcohol_units: 1, // 1 standard drink
    default_amount: 1,
    unit: 'glasses'
  },
  {
    id: 'liquor',
    name: 'Liquor (1.5oz)',
    alcohol_units: 1, // 1 standard drink
    default_amount: 1,
    unit: 'shots'
  }
];

// Combined presets for easy lookup
export const DRUG_PRESETS = {
  caffeine: CAFFEINE_PRESETS,
  alcohol: ALCOHOL_PRESETS
};

// Helper function to get presets by habit name
export const getPresetsForHabit = (habitName) => {
  const name = habitName.toLowerCase();
  if (name.includes('coffee') || name.includes('caffeine')) {
    return CAFFEINE_PRESETS;
  } else if (name.includes('alcohol') || name.includes('beer') || name.includes('wine') || name.includes('liquor')) {
    return ALCOHOL_PRESETS;
  }
  return null;
};

// Helper function to get a specific preset by ID
export const getPresetById = (presetId) => {
  // Search in caffeine presets
  const caffeinePreset = CAFFEINE_PRESETS.find(p => p.id === presetId);
  if (caffeinePreset) return { ...caffeinePreset, type: 'caffeine' };

  // Search in alcohol presets
  const alcoholPreset = ALCOHOL_PRESETS.find(p => p.id === presetId);
  if (alcoholPreset) return { ...alcoholPreset, type: 'alcohol' };

  return null;
};

// Helper function to determine drug type from habit name
export const getDrugTypeFromHabitName = (habitName) => {
  const name = habitName.toLowerCase();
  if (name.includes('coffee') || name.includes('caffeine')) {
    return 'caffeine';
  } else if (name.includes('alcohol') || name.includes('beer') || name.includes('wine') || name.includes('liquor')) {
    return 'alcohol';
  }
  return 'unknown';
};
