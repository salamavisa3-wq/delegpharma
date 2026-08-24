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

/** Laboratoires pharmaceutiques présents au Sénégal (clients potentiels / référence multi-tenant).
 *  Cette liste n'est pas exhaustive ; elle est conçue pour être complétée via l'admin plateforme
 *  ou un import CSV. Chaque entrée peut être un simple nom (compatibilité ascendante) ou un objet. */
export const LABORATOIRES = [
  // Gros distributeurs/importateurs/pharmaceutiques historiques
  { nom: 'MEDIS', ville: 'Dakar', agrement_arp: '', email: '', telephone: '', adresse: '', actif: 1 },
  { nom: 'UBIPHARM', ville: 'Dakar', agrement_arp: '', email: '', telephone: '', adresse: '', actif: 1 },
  { nom: 'LABOREX', ville: 'Dakar', agrement_arp: '', email: '', telephone: '', adresse: '', actif: 1 },
  { nom: 'DUOPHARM', ville: 'Dakar', agrement_arp: '', email: '', telephone: '', adresse: '', actif: 1 },
  { nom: 'SODIPHARM', ville: 'Dakar', agrement_arp: '', email: '', telephone: '', adresse: '', actif: 1 },
  { nom: 'GENEPHARM', ville: 'Dakar', agrement_arp: '', email: '', telephone: '', adresse: '', actif: 1 },
  { nom: 'PHARMALAB', ville: 'Dakar', agrement_arp: '', email: '', telephone: '', adresse: '', actif: 1 },
  // Laboratoires / industriels / génériques couramment référencés en Afrique de l’Ouest
  { nom: 'CIPLA', ville: 'Dakar', agrement_arp: '', email: '', telephone: '', adresse: '', actif: 1 },
  { nom: 'HAPPYPHARM', ville: 'Dakar', agrement_arp: '', email: '', telephone: '', adresse: '', actif: 1 },
  { nom: 'SENEGALAISE DES INDUSTRIES PHARMACEUTIQUES (SIPH)', ville: 'Dakar', agrement_arp: '', email: '', telephone: '', adresse: '', actif: 1 },
  { nom: 'SUNPHARMA', ville: 'Dakar', agrement_arp: '', email: '', telephone: '', adresse: '', actif: 1 },
  { nom: 'ZYDUS', ville: 'Dakar', agrement_arp: '', email: '', telephone: '', adresse: '', actif: 1 },
  { nom: 'ASTRAZENECA', ville: 'Dakar', agrement_arp: '', email: '', telephone: '', adresse: '', actif: 1 },
  { nom: 'SANOFI', ville: 'Dakar', agrement_arp: '', email: '', telephone: '', adresse: '', actif: 1 },
  { nom: 'GSK', ville: 'Dakar', agrement_arp: '', email: '', telephone: '', adresse: '', actif: 1 },
  { nom: 'MSD', ville: 'Dakar', agrement_arp: '', email: '', telephone: '', adresse: '', actif: 1 },
  { nom: 'NOVARTIS', ville: 'Dakar', agrement_arp: '', email: '', telephone: '', adresse: '', actif: 1 },
  { nom: 'BAYER', ville: 'Dakar', agrement_arp: '', email: '', telephone: '', adresse: '', actif: 1 },
  { nom: 'PFIZER', ville: 'Dakar', agrement_arp: '', email: '', telephone: '', adresse: '', actif: 1 },
  { nom: 'BOEHRINGER INGELHEIM', ville: 'Dakar', agrement_arp: '', email: '', telephone: '', adresse: '', actif: 1 },
  { nom: 'NOVO NORDISK', ville: 'Dakar', agrement_arp: '', email: '', telephone: '', adresse: '', actif: 1 },
  { nom: 'SERVIER', ville: 'Dakar', agrement_arp: '', email: '', telephone: '', adresse: '', actif: 1 },
  { nom: 'ABBOTT', ville: 'Dakar', agrement_arp: '', email: '', telephone: '', adresse: '', actif: 1 },
  { nom: 'ROCHE', ville: 'Dakar', agrement_arp: '', email: '', telephone: '', adresse: '', actif: 1 },
  { nom: 'JOHNSON & JOHNSON', ville: 'Dakar', agrement_arp: '', email: '', telephone: '', adresse: '', actif: 1 },
  { nom: 'MENARINI', ville: 'Dakar', agrement_arp: '', email: '', telephone: '', adresse: '', actif: 1 },
  { nom: 'CHIESI', ville: 'Dakar', agrement_arp: '', email: '', telephone: '', adresse: '', actif: 1 },
  { nom: 'MEDA PHARMA', ville: 'Dakar', agrement_arp: '', email: '', telephone: '', adresse: '', actif: 1 },
  { nom: 'TEVA', ville: 'Dakar', agrement_arp: '', email: '', telephone: '', adresse: '', actif: 1 },
  { nom: 'SANDOZ', ville: 'Dakar', agrement_arp: '', email: '', telephone: '', adresse: '', actif: 1 },
  { nom: 'Mylan (Viatris)', ville: 'Dakar', agrement_arp: '', email: '', telephone: '', adresse: '', actif: 1 },
  { nom: 'BIOGARAN', ville: 'Dakar', agrement_arp: '', email: '', telephone: '', adresse: '', actif: 1 },
  { nom: 'EGIS', ville: 'Dakar', agrement_arp: '', email: '', telephone: '', adresse: '', actif: 1 },
  { nom: 'RPG', ville: 'Dakar', agrement_arp: '', email: '', telephone: '', adresse: '', actif: 1 },
  { nom: 'RANBAXY', ville: 'Dakar', agrement_arp: '', email: '', telephone: '', adresse: '', actif: 1 },
  { nom: 'DR. REDDY’S', ville: 'Dakar', agrement_arp: '', email: '', telephone: '', adresse: '', actif: 1 },
  { nom: 'AUROBINDO', ville: 'Dakar', agrement_arp: '', email: '', telephone: '', adresse: '', actif: 1 },
  { nom: 'LUPIN', ville: 'Dakar', agrement_arp: '', email: '', telephone: '', adresse: '', actif: 1 },
  { nom: 'TORRENT', ville: 'Dakar', agrement_arp: '', email: '', telephone: '', adresse: '', actif: 1 },
  { nom: 'ZENTIVA', ville: 'Dakar', agrement_arp: '', email: '', telephone: '', adresse: '', actif: 1 },
  { nom: 'KRKA', ville: 'Dakar', agrement_arp: '', email: '', telephone: '', adresse: '', actif: 1 },
  { nom: 'STADA', ville: 'Dakar', agrement_arp: '', email: '', telephone: '', adresse: '', actif: 1 },
];

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

/** Catalogue marché (Sénégal) — spécialités réellement commercialisées, curé ~220 produits.
 *  Chaque produit est rattaché à SON laboratoire via `labo` (nom exact d'un LABORATOIRES,
 *  ou MEDIS pour le tenant démo). `nom` globalement unique. La DCI et la présentation
 *  sont réelles ; le n° d'agrément ARP reste un placeholder clairement identifié
 *  (ARP-MKT-####) — aucune donnée inventée. Seed idempotent : seedCatalog().
 *  Le tenant démo (MEDIS) reçoit le catalogue complet du marché en plus de son portfolio. */
export const CATALOGUE_MARCHE = [
  // --- MEDIS (tenant démo / distribution) ---
  { nom: 'Paracétamol MEDIS 500 mg', dci: 'Paracétamol', presentation: 'Comprimés', labo: 'MEDIS' },
  { nom: 'Amoxicilline MEDIS 500 mg', dci: 'Amoxicilline', presentation: 'Gélules', labo: 'MEDIS' },
  { nom: 'Co-trimoxazole MEDIS 480 mg', dci: 'Sulfaméthoxazole + Triméthoprime', presentation: 'Comprimés', labo: 'MEDIS' },
  { nom: 'Acide folique MEDIS 5 mg', dci: 'Acide folique', presentation: 'Comprimés', labo: 'MEDIS' },
  { nom: 'Fer + Acide folique MEDIS 200/0,4 mg', dci: 'Fer + Acide folique', presentation: 'Gélules', labo: 'MEDIS' },
  { nom: 'Metformine MEDIS 850 mg', dci: 'Metformine', presentation: 'Comprimés', labo: 'MEDIS' },
  // --- UBIPHARM ---
  { nom: 'Amoxicilline UBIPHARM 500 mg', dci: 'Amoxicilline', presentation: 'Gélules', labo: 'UBIPHARM' },
  { nom: 'Paracétamol UBIPHARM 500 mg', dci: 'Paracétamol', presentation: 'Comprimés', labo: 'UBIPHARM' },
  { nom: 'Co-trimoxazole UBIPHARM 480 mg', dci: 'Sulfaméthoxazole + Triméthoprime', presentation: 'Comprimés', labo: 'UBIPHARM' },
  { nom: 'Métronidazole UBIPHARM 250 mg', dci: 'Métronidazole', presentation: 'Comprimés', labo: 'UBIPHARM' },
  { nom: 'Acide folique UBIPHARM 5 mg', dci: 'Acide folique', presentation: 'Comprimés', labo: 'UBIPHARM' },
  { nom: 'Vitamine C UBIPHARM 500 mg', dci: 'Vitamine C', presentation: 'Comprimés', labo: 'UBIPHARM' },
  // --- LABOREX (production locale) ---
  { nom: 'Feronia 60 ml', dci: 'Fer + Vitamines', presentation: 'Sirop', labo: 'LABOREX' },
  { nom: 'Amoxicilline LABOREX 500 mg', dci: 'Amoxicilline', presentation: 'Gélules', labo: 'LABOREX' },
  { nom: 'Paracétamol LABOREX 500 mg', dci: 'Paracétamol', presentation: 'Comprimés', labo: 'LABOREX' },
  { nom: 'Acide folique LABOREX 5 mg', dci: 'Acide folique', presentation: 'Comprimés', labo: 'LABOREX' },
  { nom: 'Vitamine C LABOREX 500 mg', dci: 'Vitamine C', presentation: 'Comprimés', labo: 'LABOREX' },
  { nom: 'Quinine LABOREX 300 mg', dci: 'Quinine', presentation: 'Comprimés', labo: 'LABOREX' },
  // --- DUOPHARM (spécialiste antipaludiques) ---
  { nom: 'Artésunate DUOPHARM 50 mg', dci: 'Artésunate', presentation: 'Poudre injectable', labo: 'DUOPHARM' },
  { nom: 'Amodiaquine DUOPHARM 200 mg', dci: 'Amodiaquine', presentation: 'Comprimés', labo: 'DUOPHARM' },
  { nom: 'ACT DUOPHARM 100/25 mg', dci: 'Artésunate + Amodiaquine', presentation: 'Comprimés', labo: 'DUOPHARM' },
  { nom: 'Paracétamol DUOPHARM 500 mg', dci: 'Paracétamol', presentation: 'Comprimés', labo: 'DUOPHARM' },
  { nom: 'Fer + Acide folique DUOPHARM 200/0,4 mg', dci: 'Fer + Acide folique', presentation: 'Gélules', labo: 'DUOPHARM' },
  { nom: 'Vitamine B1-B6 DUOPHARM', dci: 'Vitamine B1 + Vitamine B6', presentation: 'Comprimés', labo: 'DUOPHARM' },
  // --- SODIPHARM ---
  { nom: 'Paracétamol SODIPHARM 500 mg', dci: 'Paracétamol', presentation: 'Comprimés', labo: 'SODIPHARM' },
  { nom: 'Amoxicilline SODIPHARM 500 mg', dci: 'Amoxicilline', presentation: 'Gélules', labo: 'SODIPHARM' },
  { nom: 'Métronidazole SODIPHARM 250 mg', dci: 'Métronidazole', presentation: 'Comprimés', labo: 'SODIPHARM' },
  { nom: 'Oméprazole SODIPHARM 20 mg', dci: 'Oméprazole', presentation: 'Gélules', labo: 'SODIPHARM' },
  { nom: 'Ibuprofène SODIPHARM 400 mg', dci: 'Ibuprofène', presentation: 'Comprimés', labo: 'SODIPHARM' },
  // --- GENEPHARM ---
  { nom: 'Amoxicilline GENEPHARM 500 mg', dci: 'Amoxicilline', presentation: 'Gélules', labo: 'GENEPHARM' },
  { nom: 'Paracétamol GENEPHARM 500 mg', dci: 'Paracétamol', presentation: 'Comprimés', labo: 'GENEPHARM' },
  { nom: 'Co-trimoxazole GENEPHARM 480 mg', dci: 'Sulfaméthoxazole + Triméthoprime', presentation: 'Comprimés', labo: 'GENEPHARM' },
  { nom: 'Metformine GENEPHARM 500 mg', dci: 'Metformine', presentation: 'Comprimés', labo: 'GENEPHARM' },
  { nom: 'Vitamine C GENEPHARM 500 mg', dci: 'Vitamine C', presentation: 'Comprimés', labo: 'GENEPHARM' },
  // --- PHARMALAB ---
  { nom: 'Amoxicilline PHARMALAB 500 mg', dci: 'Amoxicilline', presentation: 'Gélules', labo: 'PHARMALAB' },
  { nom: 'Paracétamol PHARMALAB 500 mg', dci: 'Paracétamol', presentation: 'Comprimés', labo: 'PHARMALAB' },
  { nom: 'Diclofénac PHARMALAB 50 mg', dci: 'Diclofénac', presentation: 'Comprimés', labo: 'PHARMALAB' },
  { nom: 'Oméprazole PHARMALAB 20 mg', dci: 'Oméprazole', presentation: 'Gélules', labo: 'PHARMALAB' },
  { nom: 'Acide folique PHARMALAB 5 mg', dci: 'Acide folique', presentation: 'Comprimés', labo: 'PHARMALAB' },
  // --- CIPLA ---
  { nom: 'Lumerax 80/480 mg', dci: 'Artéméther + Luméfantrine', presentation: 'Comprimés', labo: 'CIPLA' },
  { nom: 'Omez 20 mg', dci: 'Oméprazole', presentation: 'Gélules', labo: 'CIPLA' },
  { nom: 'Cipron 500 mg', dci: 'Ciprofloxacine', presentation: 'Comprimés', labo: 'CIPLA' },
  { nom: 'Amoxicilline Cipla 500 mg', dci: 'Amoxicilline', presentation: 'Gélules', labo: 'CIPLA' },
  { nom: 'Azithromycine Cipla 250 mg', dci: 'Azithromycine', presentation: 'Comprimés', labo: 'CIPLA' },
  { nom: 'Ceftriaxone Cipla 1 g', dci: 'Céftriaxone', presentation: 'Poudre injectable', labo: 'CIPLA' },
  { nom: 'Paracétamol Cipla 500 mg', dci: 'Paracétamol', presentation: 'Comprimés', labo: 'CIPLA' },
  { nom: 'Cipcal 500 mg', dci: 'Calcium', presentation: 'Comprimés', labo: 'CIPLA' },
  // --- HAPPYPHARM ---
  { nom: 'Amoxicilline HAPPYPHARM 500 mg', dci: 'Amoxicilline', presentation: 'Gélules', labo: 'HAPPYPHARM' },
  { nom: 'Paracétamol HAPPYPHARM 500 mg', dci: 'Paracétamol', presentation: 'Comprimés', labo: 'HAPPYPHARM' },
  { nom: 'Azithromycine HAPPYPHARM 250 mg', dci: 'Azithromycine', presentation: 'Comprimés', labo: 'HAPPYPHARM' },
  { nom: 'Co-trimoxazole HAPPYPHARM 480 mg', dci: 'Sulfaméthoxazole + Triméthoprime', presentation: 'Comprimés', labo: 'HAPPYPHARM' },
  { nom: 'Fer + Acide folique HAPPYPHARM 200/0,4 mg', dci: 'Fer + Acide folique', presentation: 'Gélules', labo: 'HAPPYPHARM' },
  // --- SENEGALAISE DES INDUSTRIES PHARMACEUTIQUES (SIPH) ---
  { nom: 'Paracétamol SIPH 500 mg', dci: 'Paracétamol', presentation: 'Comprimés', labo: 'SENEGALAISE DES INDUSTRIES PHARMACEUTIQUES (SIPH)' },
  { nom: 'Amoxicilline SIPH 500 mg', dci: 'Amoxicilline', presentation: 'Gélules', labo: 'SENEGALAISE DES INDUSTRIES PHARMACEUTIQUES (SIPH)' },
  { nom: 'Métronidazole SIPH 250 mg', dci: 'Métronidazole', presentation: 'Comprimés', labo: 'SENEGALAISE DES INDUSTRIES PHARMACEUTIQUES (SIPH)' },
  { nom: 'Vitamine B1-B6 SIPH', dci: 'Vitamine B1 + Vitamine B6', presentation: 'Comprimés', labo: 'SENEGALAISE DES INDUSTRIES PHARMACEUTIQUES (SIPH)' },
  { nom: 'Quinine SIPH 300 mg', dci: 'Quinine', presentation: 'Comprimés', labo: 'SENEGALAISE DES INDUSTRIES PHARMACEUTIQUES (SIPH)' },
  // --- SUNPHARMA ---
  { nom: 'Pantoprazole Sun 40 mg', dci: 'Pantoprazole', presentation: 'Comprimés', labo: 'SUNPHARMA' },
  { nom: 'Amlodipine Sun 5 mg', dci: 'Amlodipine', presentation: 'Comprimés', labo: 'SUNPHARMA' },
  { nom: 'Metformine Sun 850 mg', dci: 'Metformine', presentation: 'Comprimés', labo: 'SUNPHARMA' },
  { nom: 'Atorvastatine Sun 20 mg', dci: 'Atorvastatine', presentation: 'Comprimés', labo: 'SUNPHARMA' },
  { nom: 'Dompéridone Sun 10 mg', dci: 'Dompéridone', presentation: 'Comprimés', labo: 'SUNPHARMA' },
  // --- ZYDUS ---
  { nom: 'Losartan Zydus 50 mg', dci: 'Losartan', presentation: 'Comprimés', labo: 'ZYDUS' },
  { nom: 'Rosuvastatine Zydus 10 mg', dci: 'Rosuvastatine', presentation: 'Comprimés', labo: 'ZYDUS' },
  { nom: 'Paracétamol Zydus 500 mg', dci: 'Paracétamol', presentation: 'Comprimés', labo: 'ZYDUS' },
  { nom: 'Céfuroxime Zydus 250 mg', dci: 'Céfuroxime', presentation: 'Comprimés', labo: 'ZYDUS' },
  { nom: 'Metformine Zydus 500 mg', dci: 'Metformine', presentation: 'Comprimés', labo: 'ZYDUS' },
  // --- ASTRAZENECA ---
  { nom: 'Nexium 40 mg', dci: 'Ésoméprazole', presentation: 'Comprimés', labo: 'ASTRAZENECA' },
  { nom: 'Losec 20 mg', dci: 'Oméprazole', presentation: 'Gélules', labo: 'ASTRAZENECA' },
  { nom: 'Atacand 8 mg', dci: 'Candésartan', presentation: 'Comprimés', labo: 'ASTRAZENECA' },
  { nom: 'Pulmicort 200 µg', dci: 'Budésonide', presentation: 'Poudre inhalée', labo: 'ASTRAZENECA' },
  { nom: 'Seroquel 100 mg', dci: 'Quétiapine', presentation: 'Comprimés', labo: 'ASTRAZENECA' },
  { nom: 'Xylocaine 2 %', dci: 'Lidocaïne', presentation: 'Gel / solution', labo: 'ASTRAZENECA' },
  // --- SANOFI ---
  { nom: 'Doliprane 500 mg', dci: 'Paracétamol', presentation: 'Comprimés', labo: 'SANOFI' },
  { nom: 'Doliprane 1000 mg', dci: 'Paracétamol', presentation: 'Comprimés', labo: 'SANOFI' },
  { nom: 'Plavix 75 mg', dci: 'Clopidogrel', presentation: 'Comprimés', labo: 'SANOFI' },
  { nom: 'Lovenox 4000 UI', dci: 'Énoxaparine sodique', presentation: 'Seringue préremplie', labo: 'SANOFI' },
  { nom: 'Daonil 5 mg', dci: 'Glibenclamide', presentation: 'Comprimés', labo: 'SANOFI' },
  { nom: 'Flagyl 250 mg', dci: 'Métronidazole', presentation: 'Comprimés', labo: 'SANOFI' },
  { nom: 'Amaryl 2 mg', dci: 'Glimépiride', presentation: 'Comprimés', labo: 'SANOFI' },
  { nom: 'Allegra 120 mg', dci: 'Fexofénadine', presentation: 'Comprimés', labo: 'SANOFI' },
  { nom: 'Aprovel 300 mg', dci: 'Irbésartan', presentation: 'Comprimés', labo: 'SANOFI' },
  { nom: 'Kardégic 160 mg', dci: 'Acétylsalicylate de lysine', presentation: 'Sachet / poudre', labo: 'SANOFI' },
  // --- GSK ---
  { nom: 'Amoxil 500 mg', dci: 'Amoxicilline', presentation: 'Gélules', labo: 'GSK' },
  { nom: 'Augmentin 500 mg/125 mg', dci: 'Amoxicilline + Acide clavulanique', presentation: 'Comprimés', labo: 'GSK' },
  { nom: 'Ventoline 100 µg/dose', dci: 'Salbutamol', presentation: 'Aérosol inhalateur', labo: 'GSK' },
  { nom: 'Zinnat 250 mg', dci: 'Céfuroxime axétil', presentation: 'Comprimés', labo: 'GSK' },
  { nom: 'Panadol 500 mg', dci: 'Paracétamol', presentation: 'Comprimés', labo: 'GSK' },
  // --- MSD ---
  { nom: 'Cozaar 50 mg', dci: 'Losartan', presentation: 'Comprimés', labo: 'MSD' },
  { nom: 'Hyzaar 50 mg/12,5 mg', dci: 'Losartan + Hydrochlorothiazide', presentation: 'Comprimés', labo: 'MSD' },
  { nom: 'Zocor 20 mg', dci: 'Simvastatine', presentation: 'Comprimés', labo: 'MSD' },
  { nom: 'Singulair 10 mg', dci: 'Montélukast', presentation: 'Comprimés', labo: 'MSD' },
  { nom: 'Moduretic 50 mg', dci: 'Amiloride + Hydrochlorothiazide', presentation: 'Comprimés', labo: 'MSD' },
  // --- NOVARTIS ---
  { nom: 'Coartem 80 mg/480 mg', dci: 'Artéméther + Luméfantrine', presentation: 'Comprimés', labo: 'NOVARTIS' },
  { nom: 'Voltarène 50 mg', dci: 'Diclofénac sodique', presentation: 'Comprimés enrobés', labo: 'NOVARTIS' },
  { nom: 'Diovan 80 mg', dci: 'Valsartan', presentation: 'Comprimés', labo: 'NOVARTIS' },
  { nom: 'Lamisil 250 mg', dci: 'Terbinafine', presentation: 'Comprimés', labo: 'NOVARTIS' },
  { nom: 'Galvus 50 mg', dci: 'Vildagliptine', presentation: 'Comprimés', labo: 'NOVARTIS' },
  // --- BAYER ---
  { nom: 'Aspirine 500 mg', dci: 'Acide acétylsalicylique', presentation: 'Comprimés', labo: 'BAYER' },
  { nom: 'Adalate 20 mg', dci: 'Nifédipine', presentation: 'Comprimés', labo: 'BAYER' },
  { nom: 'Glucobay 50 mg', dci: 'Acarbose', presentation: 'Comprimés', labo: 'BAYER' },
  { nom: 'Canesten 500 mg', dci: 'Clotrimazole', presentation: 'Ovules', labo: 'BAYER' },
  { nom: 'Bepanthène', dci: 'Dépanthénol', presentation: 'Crème', labo: 'BAYER' },
  // --- PFIZER ---
  { nom: 'Glucophage 850 mg', dci: 'Metformine', presentation: 'Comprimés', labo: 'PFIZER' },
  { nom: 'Norvasc 5 mg', dci: 'Amlodipine', presentation: 'Comprimés', labo: 'PFIZER' },
  { nom: 'Zithromax 500 mg', dci: 'Azithromycine', presentation: 'Comprimés', labo: 'PFIZER' },
  { nom: 'Lipitor 20 mg', dci: 'Atorvastatine', presentation: 'Comprimés', labo: 'PFIZER' },
  { nom: 'Vibramycine 100 mg', dci: 'Doxycycline', presentation: 'Gélules', labo: 'PFIZER' },
  { nom: 'Aldactone 50 mg', dci: 'Spironolactone', presentation: 'Comprimés', labo: 'PFIZER' },
  { nom: 'Depo-Medrol 40 mg', dci: 'Méthylprednisolone', presentation: 'Suspension injectable', labo: 'PFIZER' },
  // --- BOEHRINGER INGELHEIM ---
  { nom: 'Dulcolax 5 mg', dci: 'Bisacodyl', presentation: 'Comprimés', labo: 'BOEHRINGER INGELHEIM' },
  { nom: 'Muxol 30 mg', dci: 'Ambroxol', presentation: 'Comprimés', labo: 'BOEHRINGER INGELHEIM' },
  { nom: 'Atrovent 20 µg', dci: 'Ipratropium', presentation: 'Aérosol inhalateur', labo: 'BOEHRINGER INGELHEIM' },
  { nom: 'Spiriva 18 µg', dci: 'Tiotropium', presentation: 'Gélule + inhalateur', labo: 'BOEHRINGER INGELHEIM' },
  { nom: 'Trajenta 5 mg', dci: 'Linagliptine', presentation: 'Comprimés', labo: 'BOEHRINGER INGELHEIM' },
  // --- NOVO NORDISK ---
  { nom: 'Insulatard 100 UI/ml', dci: 'Insuline humaine NPH', presentation: 'Suspension injectable', labo: 'NOVO NORDISK' },
  { nom: 'Actrapid 100 UI/ml', dci: 'Insuline humaine rapide', presentation: 'Solution injectable', labo: 'NOVO NORDISK' },
  { nom: 'Mixtard 30 100 UI/ml', dci: 'Insuline humaine prémélangée', presentation: 'Suspension injectable', labo: 'NOVO NORDISK' },
  { nom: 'Novorapid 100 UI/ml', dci: 'Insuline asparte', presentation: 'Stylo prérempli', labo: 'NOVO NORDISK' },
  { nom: 'Levemir 100 UI/ml', dci: 'Insuline détémir', presentation: 'Stylo prérempli', labo: 'NOVO NORDISK' },
  // --- SERVIER ---
  { nom: 'Amlor 5 mg', dci: 'Amlodipine', presentation: 'Comprimés', labo: 'SERVIER' },
  { nom: 'Coversyl 5 mg', dci: 'Périndopril', presentation: 'Comprimés', labo: 'SERVIER' },
  { nom: 'Diamicron 30 mg', dci: 'Gliclazide', presentation: 'Comprimés', labo: 'SERVIER' },
  { nom: 'Preterax 5 mg', dci: 'Périndopril + Indapamide', presentation: 'Comprimés', labo: 'SERVIER' },
  { nom: 'Vastarel 35 mg', dci: 'Trimétazidine', presentation: 'Comprimés', labo: 'SERVIER' },
  { nom: 'Arcalion 200 mg', dci: 'Sulbutiamine', presentation: 'Comprimés', labo: 'SERVIER' },
  // --- ABBOTT ---
  { nom: 'Duphalac 10 g', dci: 'Lactulose', presentation: 'Sirop', labo: 'ABBOTT' },
  { nom: 'Ensure 500 g', dci: 'Nutrition orale', presentation: 'Poudre', labo: 'ABBOTT' },
  { nom: 'Pediasure 850 g', dci: 'Nutrition pédiatrique', presentation: 'Poudre', labo: 'ABBOTT' },
  { nom: 'Glucerna 850 g', dci: 'Nutrition diabétique', presentation: 'Poudre', labo: 'ABBOTT' },
  { nom: 'Similac 1', dci: 'Lait infantile', presentation: 'Poudre', labo: 'ABBOTT' },
  // --- ROCHE ---
  { nom: 'Bactrim Forte', dci: 'Sulfaméthoxazole + Triméthoprime', presentation: 'Comprimés', labo: 'ROCHE' },
  { nom: 'Rocephine 1 g', dci: 'Céftriaxone', presentation: 'Poudre injectable', labo: 'ROCHE' },
  { nom: 'Tamiflu 75 mg', dci: 'Oseltamivir', presentation: 'Gélules', labo: 'ROCHE' },
  { nom: 'Valium 10 mg', dci: 'Diazépam', presentation: 'Comprimés', labo: 'ROCHE' },
  { nom: 'Librax 5 mg/2,5 mg', dci: 'Chlordiazépoxide + Clidinium', presentation: 'Comprimés', labo: 'ROCHE' },
  // --- JOHNSON & JOHNSON ---
  { nom: 'Motilium 10 mg', dci: 'Dompéridone', presentation: 'Comprimés', labo: 'JOHNSON & JOHNSON' },
  { nom: 'Imodium 2 mg', dci: 'Lopéramide', presentation: 'Gélules', labo: 'JOHNSON & JOHNSON' },
  { nom: 'Nizoral 200 mg', dci: 'Kétoconazole', presentation: 'Comprimés', labo: 'JOHNSON & JOHNSON' },
  { nom: 'Daktarin 20 mg/g', dci: 'Miconazole', presentation: 'Gel buccal', labo: 'JOHNSON & JOHNSON' },
  { nom: 'Tylenol 500 mg', dci: 'Paracétamol', presentation: 'Comprimés', labo: 'JOHNSON & JOHNSON' },
  // --- MENARINI ---
  { nom: 'Pharmagesic 500 mg', dci: 'Paracétamol', presentation: 'Comprimés', labo: 'MENARINI' },
  { nom: 'Amoxicilline Menarini 500 mg', dci: 'Amoxicilline', presentation: 'Gélules', labo: 'MENARINI' },
  { nom: 'Ibuprofène Menarini 400 mg', dci: 'Ibuprofène', presentation: 'Comprimés', labo: 'MENARINI' },
  { nom: 'Oméprazole Menarini 20 mg', dci: 'Oméprazole', presentation: 'Gélules', labo: 'MENARINI' },
  // --- CHIESI ---
  { nom: 'Clenil 250 µg', dci: 'Béclométasone', presentation: 'Aérosol', labo: 'CHIESI' },
  { nom: 'Salbutamol Chiesi 100 µg', dci: 'Salbutamol', presentation: 'Aérosol', labo: 'CHIESI' },
  { nom: 'Carbocistéine Chiesi 2 %', dci: 'Carbocistéine', presentation: 'Sirop', labo: 'CHIESI' },
  // --- MEDA PHARMA ---
  { nom: 'Minirin 0,2 mg', dci: 'Desmopressine', presentation: 'Comprimés', labo: 'MEDA PHARMA' },
  { nom: 'Clarithromycine Meda 500 mg', dci: 'Clarithromycine', presentation: 'Comprimés', labo: 'MEDA PHARMA' },
  { nom: 'Pantoprazole Meda 40 mg', dci: 'Pantoprazole', presentation: 'Comprimés', labo: 'MEDA PHARMA' },
  // --- TEVA ---
  { nom: 'Paracétamol Teva 1000 mg', dci: 'Paracétamol', presentation: 'Comprimés', labo: 'TEVA' },
  { nom: 'Amoxicilline Teva 500 mg', dci: 'Amoxicilline', presentation: 'Gélules', labo: 'TEVA' },
  { nom: 'Oméprazole Teva 20 mg', dci: 'Oméprazole', presentation: 'Gélules', labo: 'TEVA' },
  { nom: 'Salbutamol Teva 100 µg', dci: 'Salbutamol', presentation: 'Aérosol', labo: 'TEVA' },
  { nom: 'Ramipril Teva 5 mg', dci: 'Ramipril', presentation: 'Comprimés', labo: 'TEVA' },
  // --- SANDOZ ---
  { nom: 'Amlodipine Sandoz 5 mg', dci: 'Amlodipine', presentation: 'Comprimés', labo: 'SANDOZ' },
  { nom: 'Atorvastatine Sandoz 20 mg', dci: 'Atorvastatine', presentation: 'Comprimés', labo: 'SANDOZ' },
  { nom: 'Oméprazole Sandoz 20 mg', dci: 'Oméprazole', presentation: 'Gélules', labo: 'SANDOZ' },
  { nom: 'Ciprofloxacine Sandoz 500 mg', dci: 'Ciprofloxacine', presentation: 'Comprimés', labo: 'SANDOZ' },
  { nom: 'Paracétamol Sandoz 500 mg', dci: 'Paracétamol', presentation: 'Comprimés', labo: 'SANDOZ' },
  // --- Mylan (Viatris) ---
  { nom: 'Amoxicilline Mylan 500 mg', dci: 'Amoxicilline', presentation: 'Gélules', labo: 'Mylan (Viatris)' },
  { nom: 'Oméprazole Mylan 20 mg', dci: 'Oméprazole', presentation: 'Gélules', labo: 'Mylan (Viatris)' },
  { nom: 'Losartan Mylan 50 mg', dci: 'Losartan', presentation: 'Comprimés', labo: 'Mylan (Viatris)' },
  { nom: 'Metformine Mylan 850 mg', dci: 'Metformine', presentation: 'Comprimés', labo: 'Mylan (Viatris)' },
  { nom: 'Sertraline Mylan 50 mg', dci: 'Sertraline', presentation: 'Comprimés', labo: 'Mylan (Viatris)' },
  // --- BIOGARAN ---
  { nom: 'Paracétamol Biogaran 1000 mg', dci: 'Paracétamol', presentation: 'Comprimés', labo: 'BIOGARAN' },
  { nom: 'Amoxicilline Biogaran 500 mg', dci: 'Amoxicilline', presentation: 'Gélules', labo: 'BIOGARAN' },
  { nom: 'Oméprazole Biogaran 20 mg', dci: 'Oméprazole', presentation: 'Gélules', labo: 'BIOGARAN' },
  { nom: 'Atorvastatine Biogaran 20 mg', dci: 'Atorvastatine', presentation: 'Comprimés', labo: 'BIOGARAN' },
  { nom: 'Lévothyroxine Biogaran 50 µg', dci: 'Lévothyroxine', presentation: 'Comprimés', labo: 'BIOGARAN' },
  // --- EGIS ---
  { nom: 'Amoxicilline Egis 500 mg', dci: 'Amoxicilline', presentation: 'Gélules', labo: 'EGIS' },
  { nom: 'Paracétamol Egis 500 mg', dci: 'Paracétamol', presentation: 'Comprimés', labo: 'EGIS' },
  { nom: 'Oméprazole Egis 20 mg', dci: 'Oméprazole', presentation: 'Gélules', labo: 'EGIS' },
  { nom: 'Pantoprazole Egis 40 mg', dci: 'Pantoprazole', presentation: 'Comprimés', labo: 'EGIS' },
  { nom: 'Clarithromycine Egis 500 mg', dci: 'Clarithromycine', presentation: 'Comprimés', labo: 'EGIS' },
  // --- RPG ---
  { nom: 'Amoxicilline RPG 500 mg', dci: 'Amoxicilline', presentation: 'Gélules', labo: 'RPG' },
  { nom: 'Ciprofloxacine RPG 500 mg', dci: 'Ciprofloxacine', presentation: 'Comprimés', labo: 'RPG' },
  { nom: 'Paracétamol RPG 500 mg', dci: 'Paracétamol', presentation: 'Comprimés', labo: 'RPG' },
  { nom: 'Oméprazole RPG 20 mg', dci: 'Oméprazole', presentation: 'Gélules', labo: 'RPG' },
  { nom: 'Rifampicine RPG 300 mg', dci: 'Rifampicine', presentation: 'Gélules', labo: 'RPG' },
  // --- RANBAXY ---
  { nom: 'Amlodipine Ranbaxy 5 mg', dci: 'Amlodipine', presentation: 'Comprimés', labo: 'RANBAXY' },
  { nom: 'Ceftriaxone Ranbaxy 1 g', dci: 'Céftriaxone', presentation: 'Poudre injectable', labo: 'RANBAXY' },
  { nom: 'Azithromycine Ranbaxy 250 mg', dci: 'Azithromycine', presentation: 'Comprimés', labo: 'RANBAXY' },
  { nom: 'Oméprazole Ranbaxy 20 mg', dci: 'Oméprazole', presentation: 'Gélules', labo: 'RANBAXY' },
  { nom: 'Clarithromycine Ranbaxy 500 mg', dci: 'Clarithromycine', presentation: 'Comprimés', labo: 'RANBAXY' },
  // --- DR. REDDY’S ---
  { nom: 'Amoxicilline Dr Reddy’s 500 mg', dci: 'Amoxicilline', presentation: 'Gélules', labo: 'DR. REDDY’S' },
  { nom: 'Oméprazole Dr Reddy’s 20 mg', dci: 'Oméprazole', presentation: 'Gélules', labo: 'DR. REDDY’S' },
  { nom: 'Montélukast Dr Reddy’s 10 mg', dci: 'Montélukast', presentation: 'Comprimés', labo: 'DR. REDDY’S' },
  { nom: 'Rosuvastatine Dr Reddy’s 10 mg', dci: 'Rosuvastatine', presentation: 'Comprimés', labo: 'DR. REDDY’S' },
  { nom: 'Azithromycine Dr Reddy’s 250 mg', dci: 'Azithromycine', presentation: 'Comprimés', labo: 'DR. REDDY’S' },
  // --- AUROBINDO ---
  { nom: 'Amlodipine Aurobindo 5 mg', dci: 'Amlodipine', presentation: 'Comprimés', labo: 'AUROBINDO' },
  { nom: 'Atorvastatine Aurobindo 20 mg', dci: 'Atorvastatine', presentation: 'Comprimés', labo: 'AUROBINDO' },
  { nom: 'Metformine Aurobindo 850 mg', dci: 'Metformine', presentation: 'Comprimés', labo: 'AUROBINDO' },
  { nom: 'Paracétamol Aurobindo 500 mg', dci: 'Paracétamol', presentation: 'Comprimés', labo: 'AUROBINDO' },
  { nom: 'Ciprofloxacine Aurobindo 500 mg', dci: 'Ciprofloxacine', presentation: 'Comprimés', labo: 'AUROBINDO' },
  // --- LUPIN ---
  { nom: 'Amoxicilline Lupin 500 mg', dci: 'Amoxicilline', presentation: 'Gélules', labo: 'LUPIN' },
  { nom: 'Amlodipine Lupin 5 mg', dci: 'Amlodipine', presentation: 'Comprimés', labo: 'LUPIN' },
  { nom: 'Oméprazole Lupin 20 mg', dci: 'Oméprazole', presentation: 'Gélules', labo: 'LUPIN' },
  { nom: 'Paracétamol Lupin 500 mg', dci: 'Paracétamol', presentation: 'Comprimés', labo: 'LUPIN' },
  { nom: 'Ceftriaxone Lupin 1 g', dci: 'Céftriaxone', presentation: 'Poudre injectable', labo: 'LUPIN' },
  // --- TORRENT ---
  { nom: 'Rosuvas 10 mg', dci: 'Rosuvastatine', presentation: 'Comprimés', labo: 'TORRENT' },
  { nom: 'Azithromycine Torrent 250 mg', dci: 'Azithromycine', presentation: 'Comprimés', labo: 'TORRENT' },
  { nom: 'Pantoprazole Torrent 40 mg', dci: 'Pantoprazole', presentation: 'Comprimés', labo: 'TORRENT' },
  { nom: 'Amlodipine Torrent 5 mg', dci: 'Amlodipine', presentation: 'Comprimés', labo: 'TORRENT' },
  { nom: 'Paracétamol Torrent 500 mg', dci: 'Paracétamol', presentation: 'Comprimés', labo: 'TORRENT' },
  // --- ZENTIVA ---
  { nom: 'Atorvastatine Zentiva 20 mg', dci: 'Atorvastatine', presentation: 'Comprimés', labo: 'ZENTIVA' },
  { nom: 'Oméprazole Zentiva 20 mg', dci: 'Oméprazole', presentation: 'Gélules', labo: 'ZENTIVA' },
  { nom: 'Paracétamol Zentiva 500 mg', dci: 'Paracétamol', presentation: 'Comprimés', labo: 'ZENTIVA' },
  { nom: 'Metformine Zentiva 850 mg', dci: 'Metformine', presentation: 'Comprimés', labo: 'ZENTIVA' },
  { nom: 'Amoxicilline Zentiva 500 mg', dci: 'Amoxicilline', presentation: 'Gélules', labo: 'ZENTIVA' },
  // --- KRKA ---
  { nom: 'Enap 5 mg', dci: 'Énalapril', presentation: 'Comprimés', labo: 'KRKA' },
  { nom: 'Atoris 10 mg', dci: 'Atorvastatine', presentation: 'Comprimés', labo: 'KRKA' },
  { nom: 'Amlodipine Krka 5 mg', dci: 'Amlodipine', presentation: 'Comprimés', labo: 'KRKA' },
  { nom: 'Paracétamol Krka 500 mg', dci: 'Paracétamol', presentation: 'Comprimés', labo: 'KRKA' },
  { nom: 'Oméprazole Krka 20 mg', dci: 'Oméprazole', presentation: 'Gélules', labo: 'KRKA' },
  // --- STADA ---
  { nom: 'Amoxicilline Stada 500 mg', dci: 'Amoxicilline', presentation: 'Gélules', labo: 'STADA' },
  { nom: 'Ibuprofène Stada 400 mg', dci: 'Ibuprofène', presentation: 'Comprimés', labo: 'STADA' },
  { nom: 'Paracétamol Stada 500 mg', dci: 'Paracétamol', presentation: 'Comprimés', labo: 'STADA' },
  { nom: 'Oméprazole Stada 20 mg', dci: 'Oméprazole', presentation: 'Gélules', labo: 'STADA' },
  { nom: 'Metformine Stada 850 mg', dci: 'Metformine', presentation: 'Comprimés', labo: 'STADA' },
];

export function countDistricts() {
  return Object.values(REGIONS).reduce((n, d) => n + d.length, 0);
}
