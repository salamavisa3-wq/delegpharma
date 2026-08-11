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

/** Formules d'abonnement mensuel (spec §3). */
export const FORMULES = [
  { nom: 'Essentiel', prix: 5000, duree_jours: 30,
    fonctionnalites: ['Rapports de visite', 'Fiche professionnel de santé', 'Tableau de bord personnel'] },
  { nom: 'Standard', prix: 10000, duree_jours: 30,
    fonctionnalites: ['Tout Essentiel', 'Suivi des objectifs produit phare par zone', 'Exports (CSV/PDF)', 'Notifications de relance'] },
  { nom: 'Premium', prix: 15000, duree_jours: 30,
    fonctionnalites: ['Tout Standard', 'Statistiques comparatives', 'Historique étendu', 'Support prioritaire'] },
];

/** Comptes étendus (seed idempotent séparé — disponibles même si seeded_v1 existe). */
export const USERS_EXT = [
  { nom: 'Admin Plateforme', email: 'admin.plateforme', role: 'plateforme', password: 'Admin@2026Plateforme' },
  { nom: 'Dr Awa Ndiaye', email: 'ps.demo', role: 'professionnel', password: 'Ps@2026Deleg', professionnelNom: 'Dr Awa Ndiaye' },
];

/** Activité démo (rubriques Phase 4) — seed idempotent seedDemoActivity().
 *  Structures/professionnels ADDITIONNELS au référentiel de base ; CRV aux 4 statuts,
 *  tournées (planifiée/faite) avec checklist par district, objectifs par produit/zone,
 *  et abonnement actif pour le délégué démo (sinon §3.2 bloque ses écritures).
 *  Références par nom stable : arp = agrement_arp d'un PRODUITS (ARP-DEMO-000x). */
export const DEMO_ACTIVITY = {
  abonnement: {
    userEmail: 'dm.senegal', formule: 'Essentiel',
    date_debut: '2026-08-01', date_expiration: '2026-08-31',
  },
  structures: [
    { nom: 'Hôpital Aristide Le Dantec', type: 'Hôpital', region: 'Dakar', district: 'Dakar-Nord', localite: 'Avenue Pasteur, Fann, Dakar' },
    { nom: 'Poste de santé de Grand Yoff', type: 'Poste de santé', region: 'Dakar', district: 'Dakar-Ouest', localite: 'Grand Yoff, Dakar' },
    { nom: 'Centre de santé de Bambey', type: 'Centre de santé', region: 'Diourbel', district: 'Bambey', localite: 'Bambey' },
    { nom: 'Hôpital régional de Saint-Louis', type: 'Hôpital', region: 'Saint-Louis', district: 'Saint-Louis', localite: 'Saint-Louis' },
    { nom: 'Poste de santé de Richard Toll', type: 'Poste de santé', region: 'Saint-Louis', district: 'Richard Toll', localite: 'Richard Toll' },
  ],
  professionnels: [
    { nom: 'Dr Khadija Ndiaye', specialite: 'Pharmacie', structure: 'Hôpital Aristide Le Dantec', potentiel: 'A', telephone: '772345678' },
    { nom: 'Dr Ibrahima Cissé', specialite: 'Médecine interne', structure: 'Hôpital Aristide Le Dantec', potentiel: 'B', telephone: '778901234' },
    { nom: 'Dr Ndeye Coumba Fall', specialite: 'Pédiatrie', structure: 'Poste de santé de Grand Yoff', potentiel: 'B', telephone: '765432109' },
    { nom: 'Dr Serigne Mbacké', specialite: 'Médecine générale', structure: 'Centre de santé de Bambey', potentiel: 'A', telephone: '761112220' },
    { nom: 'Dr Amadou Diagne', specialite: 'Chirurgie', structure: 'Hôpital régional de Saint-Louis', potentiel: 'A', telephone: '774443335' },
    { nom: 'Dr Aissatou Ba', specialite: 'Santé publique', structure: 'Poste de santé de Richard Toll', potentiel: 'C', telephone: '755556660' },
  ],
  visites: [
    { professionnel: 'Dr Khadija Ndiaye', date: '2026-08-06', produits: [{ arp: 'ARP-DEMO-0001', qty: 2 }],
      resultat: 'reserve', statut: 'brouillon',
      compte_rendu: 'Première prise de contact avec la pharmacie hospitalière. Stock de sels d’artémisinine suffisant ; à revenir avec la documentation comparative.',
      prochaine_visite: '2026-08-20', motif_refus: '' },
    { professionnel: 'Dr Mamadou Sarr', date: '2026-08-09', produits: [{ arp: 'ARP-DEMO-0001', qty: 5 }],
      resultat: 'accord', statut: 'soumis',
      compte_rendu: 'Relance campagne paludisme : le service de cardiologie prescrit peu d’ACT, mais accord de principe pour la mise à disposition d’échantillons.',
      prochaine_visite: '2026-08-23', motif_refus: '' },
    { professionnel: 'Dr Khadija Ndiaye', date: '2026-08-04', produits: [{ arp: 'ARP-DEMO-0001', qty: 6 }],
      resultat: 'accord', statut: 'valide',
      compte_rendu: 'Commande ferme de 6 boîtes ACT-Fast pour le service de pharmacie. Bonne visibilité de la campagne.',
      prochaine_visite: '2026-08-18', motif_refus: '' },
    { professionnel: 'Dr Cheikh Ba', date: '2026-08-02', produits: [{ arp: 'ARP-DEMO-0001', qty: 4 }],
      resultat: 'accord', statut: 'valide',
      compte_rendu: 'Pédiatrie — accord sur 4 boîtes ACT-Fast ; recommandation de renforcer la diffusion des affiches de dosage.',
      prochaine_visite: '2026-08-16', motif_refus: '' },
    { professionnel: 'Dr Aissatou Ba', date: '2026-08-05', produits: [{ arp: 'ARP-DEMO-0003', qty: 3 }],
      resultat: 'accord', statut: 'valide',
      compte_rendu: 'Dépôt de Ferrex Fol au poste de santé ; intérêt marqué pour la lutte contre l’anémie chez la femme enceinte.',
      prochaine_visite: '2026-08-19', motif_refus: '' },
    { professionnel: 'Dr Omar Gueye', date: '2026-08-01', produits: [{ arp: 'ARP-DEMO-0002', qty: 8 }],
      resultat: 'refus', statut: 'refuse',
      compte_rendu: 'Visite signalée en doublon — compte rendu déjà transmis par un collègue.',
      prochaine_visite: '', motif_refus: 'Doublon de visite déjà reportée le 28/07' },
  ],
  tournees: [
    { date: '2026-08-14', region: 'Dakar', district: 'Dakar-Centre', statut: 'planifiee',
      ps_list: ['Dr Awa Ndiaye', 'Dr Fatou Diallo', 'Dr Mamadou Sarr'] },
    { date: '2026-08-05', region: 'Thiès', district: 'Mbour', statut: 'faite',
      ps_list: ['Dr Mariama Sow'] },
    { date: '2026-08-18', region: 'Diourbel', district: 'Bambey', statut: 'planifiee',
      ps_list: ['Dr Serigne Mbacké'] },
  ],
  objectifs: [
    { arp: 'ARP-DEMO-0001', userEmail: 'dm.senegal', region: 'Dakar', objectif: 20, debut: '2026-08-01', fin: '2026-08-31' },
    { arp: 'ARP-DEMO-0003', region: 'Saint-Louis', objectif: 8, debut: '2026-08-01', fin: '2026-08-31' },
  ],
};

export function countDistricts() {
  return Object.values(REGIONS).reduce((n, d) => n + d.length, 0);
}
