// Données de référence du Sénégal (Carte Sanitaire et Sociale — MSAS/ANSD).
// Porté tel quel depuis le plugin WordPress delegpharma-saas (class-senegal-seed.php).
// 14 régions médicales > 79 districts sanitaires. N° d'agrément ARP = placeholders démo.

export const PAYS = { code: 'SN', nom: 'Sénégal' };

/** Région médicale -> districts sanitaires (79). */
export const REGIONS = {
  Dakar: ['Dakar-Centre', 'Dakar-Nord', 'Dakar-Sud', 'Dakar-Ouest', 'Guédiawaye', 'Keur Massar', 'Pikine', 'Rufisque', 'Bambilor'],
  Diourbel: ['Bambey', 'Diourbel', 'Mbacké', 'Ndiagne', 'Touba'],
  Fatick: ['Diofior', 'Fatick', 'Foundiougne', 'Gossas', 'Sokone'],
  Kaffrine: ['Birkelane', 'Kaffrine', 'Koungheul', 'Malem-Hodar', 'Nganda'],
  Kaolack: ['Guinguinéo', 'Kaolack', 'Ndoffane', 'Nioro du Rip', 'Sibassor'],
  Kédougou: ['Kédougou', 'Salémata', 'Saraya'],
  Kolda: ['Kolda', 'Médina Yoro Foulah', 'Vélingara', 'Dabo', 'Saré Yoba', 'Linkering'],
  Louga: ['Dahra', 'Kébémer', 'Linguère', 'Louga'],
  Matam: ['Kanel', 'Matam', 'Ourossogui', 'Ranérou', 'Thilogne'],
  'Saint-Louis': ['Dagana', 'Darha', 'Ndioum', 'Podor', 'Richard Toll', 'Saint-Louis', 'Diama'],
  Sédhiou: ['Bounkiling', 'Goudomp', 'Marsassoum', 'Sédhiou'],
  Tambacounda: ['Bakel', 'Goudiry', 'Kidira', 'Koumpentoum', 'Tambacounda'],
  Thiès: ['Fandène', 'Joal-Fadiouth', 'Khombole', 'Mbour', 'Mékhé', 'Pout', 'Thiès', 'Thiès-Nord', 'Tivaouane'],
  Ziguinchor: ['Bignona', 'Oussouye', 'Sindian', 'Thionck-Essyl', 'Ziguinchor', 'Ziguinchor-Sud', 'Diouloulou'],
};

export const TYPES_STRUCTURE = ['Hôpital', 'Centre de santé', 'Poste de santé', 'Case de santé'];

export const SPECIALITES = [
  'Médecine générale', 'Pharmacie', 'Pédiatrie', 'Gynécologie-obstétrique', 'Cardiologie',
  'Médecine interne', 'Chirurgie', 'Odontologie', 'Ophtalmologie', 'Santé publique',
];

/** Laboratoires de la place (clients potentiels du SaaS — référence multi-tenant). */
export const LABORATOIRES = ['MEDIS', 'UBIPHARM', 'LABOREX', 'DUOPHARM', 'SODIPHARM', 'GENEPHARM', 'PHARMALAB'];

/** Tenant de démonstration : le laboratoire propriétaire des données démo. */
export const TENANT_DEMO = 'MEDIS';

/** Structures de démonstration (index 0-4, référencés par les professionnels). */
export const STRUCTURES = [
  { nom: 'Hôpital Principal de Dakar', type: 'Hôpital', region: 'Dakar', district: 'Dakar-Centre', localite: 'Avenue Pasteur, Dakar' },
  { nom: 'Centre de santé Philippe Maguilen Senghor', type: 'Centre de santé', region: 'Dakar', district: 'Dakar-Centre', localite: 'Yoff, Dakar' },
  { nom: 'Poste de santé de Fann Hock', type: 'Poste de santé', region: 'Dakar', district: 'Dakar-Nord', localite: 'Fann Hock, Dakar' },
  { nom: 'Hôpital régional de Thiès', type: 'Hôpital', region: 'Thiès', district: 'Thiès', localite: 'Thiès' },
  { nom: 'Centre de santé de Mbour', type: 'Centre de santé', region: 'Thiès', district: 'Mbour', localite: 'Mbour' },
];

/** Professionnels de démonstration. structureIndex pointe dans STRUCTURES. */
export const PROFESSIONNELS = [
  { nom: 'Dr Awa Ndiaye', specialite: 'Médecine générale', structureIndex: 0, potentiel: 'A', telephone: '771234567' },
  { nom: 'Dr Mamadou Sarr', specialite: 'Cardiologie', structureIndex: 0, potentiel: 'B', telephone: '770987654' },
  { nom: 'Dr Fatou Diallo', specialite: 'Gynécologie-obstétrique', structureIndex: 0, potentiel: 'A', telephone: '775566778' },
  { nom: 'Dr Cheikh Ba', specialite: 'Pédiatrie', structureIndex: 3, potentiel: 'B', telephone: '760102030' },
  { nom: 'Dr Mariama Sow', specialite: 'Médecine générale', structureIndex: 4, potentiel: 'C', telephone: '781112223' },
  { nom: 'Dr Omar Gueye', specialite: 'Cardiologie', structureIndex: 3, potentiel: 'A', telephone: '772223334' },
];

/** Produits phares (n° d'agrément ARP = placeholder de démonstration). */
export const PRODUITS = [
  { nom: 'ACT-Fast 100/25 mg', dci: 'Artésunate 100 mg + Amodiaquine 25 mg', presentation: 'Comprimés', agrement_arp: 'ARP-DEMO-0001' },
  { nom: 'Zenfu C 500 mg', dci: 'Paracétamol + Vitamine C', presentation: 'Comprimés', agrement_arp: 'ARP-DEMO-0002' },
  { nom: 'Ferrex Fol 200/0,4 mg', dci: 'Fer + Acide folique', presentation: 'Gélules', agrement_arp: 'ARP-DEMO-0003' },
];

/** Campagne de démonstration. */
export const CAMPAGNE = {
  nom: 'Campagne paludisme — ACT-Fast (Dakar)',
  produitIndex: 0,
  agrement_arp: 'ARP-DEMO-0001',
  objectif: 40,
  statut: 'active',
  region: 'Dakar',
  district: 'Dakar-Centre',
};

/** Comptes de démonstration (mots de passe à changer par l'utilisateur). */
export const USERS_DEMO = [
  { nom: 'Awa Diop', email: 'dm.senegal', role: 'delegue', password: 'Dm@2026Deleg' },
  { nom: 'Moussa Fall', email: 'manager.senegal', role: 'manager', password: 'Manager@2026' },
  { nom: 'Compte Laboratoire', email: 'labo.pharma', role: 'laboratoire', password: 'Labo@2026Pharma' },
];

export function countDistricts() {
  return Object.values(REGIONS).reduce((n, d) => n + d.length, 0);
}
