// DelegPharma — Enrichissement de la Carte Sanitaire et Sociale du Sénégal (MSAS/ANSD).
// La hiérarchie (14 régions médicales > 79 districts sanitaires) vit en base (seed-data.js) ;
// ce fichier ajoute les données de référence publiques (population, chef-lieu, code) utilisées
// par les pages SSR publiques (/carte-sanitaire/*). Sources : ANSD (Annuaire de la population
// du Sénégal 2024, projections RGPH-5) et MSAS (esante.sn — Carte Sanitaire et Sociale).
// NB : la population par district n'est pas publiée de façon fiable en open data — on ne
// l'invente pas ; les pages district s'appuient sur la géographie + la population régionale.

export const NATIONAL = {
  population: 18593258, // Sénégal, projection ANSD 2024
  regions: 14,
  districts: 79,
  structures: 3915, // Carte Sanitaire et Sociale (MSAS)
  postesSante: 1584,
  centresSante: 107,
  hopitaux: 40,
  casesSante: 2197,
  professionnels: 34388, // ressources humaines en santé (MSAS)
};

/** Population 2024 (ANSD) + chef-lieu + code ISO 3166-2:SN par région médicale. */
export const REGION_INFO = {
  Dakar: { code: 'SN-1', population: 4080505, chefLieu: 'Dakar' },
  Diourbel: { code: 'SN-2', population: 2143280, chefLieu: 'Diourbel' },
  Fatick: { code: 'SN-3', population: 932652, chefLieu: 'Fatick' },
  Kaffrine: { code: 'SN-4', population: 848581, chefLieu: 'Kaffrine' },
  Kaolack: { code: 'SN-5', population: 1375350, chefLieu: 'Kaolack' },
  Kédougou: { code: 'SN-6', population: 252078, chefLieu: 'Kédougou' },
  Kolda: { code: 'SN-7', population: 941510, chefLieu: 'Kolda' },
  Louga: { code: 'SN-8', population: 1155704, chefLieu: 'Louga' },
  Matam: { code: 'SN-9', population: 855288, chefLieu: 'Matam' },
  'Saint-Louis': { code: 'SN-10', population: 1230597, chefLieu: 'Saint-Louis' },
  Sédhiou: { code: 'SN-11', population: 606771, chefLieu: 'Sédhiou' },
  Tambacounda: { code: 'SN-12', population: 1017562, chefLieu: 'Tambacounda' },
  Thiès: { code: 'SN-13', population: 2524514, chefLieu: 'Thiès' },
  Ziguinchor: { code: 'SN-14', population: 628864, chefLieu: 'Ziguinchor' },
};

/** Chef-lieu par district sanitaire (le plus souvent la ville éponyme). */
export const DISTRICT_INFO = {
  // Dakar (9)
  'Dakar-Centre': { chefLieu: 'Dakar' },
  'Dakar-Nord': { chefLieu: 'Dakar' },
  'Dakar-Sud': { chefLieu: 'Dakar' },
  'Dakar-Ouest': { chefLieu: 'Dakar' },
  'Guédiawaye': { chefLieu: 'Guédiawaye' },
  'Keur Massar': { chefLieu: 'Keur Massar' },
  'Pikine': { chefLieu: 'Pikine' },
  'Rufisque': { chefLieu: 'Rufisque' },
  'Bambilor': { chefLieu: 'Bambilor' },
  // Diourbel (5)
  'Bambey': { chefLieu: 'Bambey' },
  'Diourbel': { chefLieu: 'Diourbel' },
  'Mbacké': { chefLieu: 'Mbacké' },
  'Ndiagne': { chefLieu: 'Ndiagne' },
  'Touba': { chefLieu: 'Touba' },
  // Fatick (5)
  'Diofior': { chefLieu: 'Diofior' },
  'Fatick': { chefLieu: 'Fatick' },
  'Foundiougne': { chefLieu: 'Foundiougne' },
  'Gossas': { chefLieu: 'Gossas' },
  'Sokone': { chefLieu: 'Sokone' },
  // Kaffrine (5)
  'Birkelane': { chefLieu: 'Birkelane' },
  'Kaffrine': { chefLieu: 'Kaffrine' },
  'Koungheul': { chefLieu: 'Koungheul' },
  'Malem-Hodar': { chefLieu: 'Malem-Hodar' },
  'Nganda': { chefLieu: 'Nganda' },
  // Kaolack (5)
  'Guinguinéo': { chefLieu: 'Guinguinéo' },
  'Kaolack': { chefLieu: 'Kaolack' },
  'Ndoffane': { chefLieu: 'Ndoffane' },
  'Nioro du Rip': { chefLieu: 'Nioro du Rip' },
  'Sibassor': { chefLieu: 'Sibassor' },
  // Kédougou (3)
  'Kédougou': { chefLieu: 'Kédougou' },
  'Salémata': { chefLieu: 'Salémata' },
  'Saraya': { chefLieu: 'Saraya' },
  // Kolda (6)
  'Kolda': { chefLieu: 'Kolda' },
  'Médina Yoro Foulah': { chefLieu: 'Médina Yoro Foulah' },
  'Vélingara': { chefLieu: 'Vélingara' },
  'Dabo': { chefLieu: 'Dabo' },
  'Saré Yoba': { chefLieu: 'Saré Yoba' },
  'Linkering': { chefLieu: 'Linkering' },
  // Louga (4)
  'Dahra': { chefLieu: 'Dahra' },
  'Kébémer': { chefLieu: 'Kébémer' },
  'Linguère': { chefLieu: 'Linguère' },
  'Louga': { chefLieu: 'Louga' },
  // Matam (5)
  'Kanel': { chefLieu: 'Kanel' },
  'Matam': { chefLieu: 'Matam' },
  'Ourossogui': { chefLieu: 'Ourossogui' },
  'Ranérou': { chefLieu: 'Ranérou' },
  'Thilogne': { chefLieu: 'Thilogne' },
  // Saint-Louis (7)
  'Dagana': { chefLieu: 'Dagana' },
  'Darha': { chefLieu: 'Darha' },
  'Ndioum': { chefLieu: 'Ndioum' },
  'Podor': { chefLieu: 'Podor' },
  'Richard Toll': { chefLieu: 'Richard Toll' },
  'Saint-Louis': { chefLieu: 'Saint-Louis' },
  'Diama': { chefLieu: 'Diama' },
  // Sédhiou (4)
  'Bounkiling': { chefLieu: 'Bounkiling' },
  'Goudomp': { chefLieu: 'Goudomp' },
  'Marsassoum': { chefLieu: 'Marsassoum' },
  'Sédhiou': { chefLieu: 'Sédhiou' },
  // Tambacounda (5)
  'Bakel': { chefLieu: 'Bakel' },
  'Goudiry': { chefLieu: 'Goudiry' },
  'Kidira': { chefLieu: 'Kidira' },
  'Koumpentoum': { chefLieu: 'Koumpentoum' },
  'Tambacounda': { chefLieu: 'Tambacounda' },
  // Thiès (9)
  'Fandène': { chefLieu: 'Fandène' },
  'Joal-Fadiouth': { chefLieu: 'Joal-Fadiouth' },
  'Khombole': { chefLieu: 'Khombole' },
  'Mbour': { chefLieu: 'Mbour' },
  'Mékhé': { chefLieu: 'Mékhé' },
  'Pout': { chefLieu: 'Pout' },
  'Thiès': { chefLieu: 'Thiès' },
  'Thiès-Nord': { chefLieu: 'Thiès' },
  'Tivaouane': { chefLieu: 'Tivaouane' },
  // Ziguinchor (7)
  'Bignona': { chefLieu: 'Bignona' },
  'Oussouye': { chefLieu: 'Oussouye' },
  'Sindian': { chefLieu: 'Sindian' },
  'Thionck-Essyl': { chefLieu: 'Thionck-Essyl' },
  'Ziguinchor': { chefLieu: 'Ziguinchor' },
  'Ziguinchor-Sud': { chefLieu: 'Ziguinchor' },
  'Diouloulou': { chefLieu: 'Diouloulou' },
};
