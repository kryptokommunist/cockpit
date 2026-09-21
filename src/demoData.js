// Generates 6 months of realistic German personal finance demo transactions

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function makeId(iso, amount, payee) {
  return `${new Date(iso).getTime()}-${Math.abs(amount).toFixed(2)}-${payee.substring(0, 20)}`.replace(/[^a-zA-Z0-9-]/g, '');
}

function tx(daysBack, payee, purpose, amount, category) {
  const iso = daysAgo(daysBack);
  return {
    id: makeId(iso, amount, payee),
    bookingDate: iso,
    valueDate: iso,
    payee,
    purpose,
    accountNumber: '',
    bankCode: '',
    amount,
    currency: 'EUR',
    category,
    normalizedMerchant: payee,
  };
}

export const DEMO_TRANSACTIONS = [
  // --- Month 0 (current) ---
  tx(1,  'REWE SAGT DANKE',       'Einkauf 20.09.',         -67.43, 'GROCERIES'),
  tx(2,  'Spotify AB',            'SPOTIFY P1ABC123',       -9.99,  'ENTERTAINMENT'),
  tx(3,  'Stadtwerke Muenchen',   'Strom Sept 2026',        -89.00, 'UTILITIES'),
  tx(4,  'EDEKA CENTER',          'Einkauf 17.09.',         -54.20, 'GROCERIES'),
  tx(5,  'Arbeitgeber GmbH',      'Gehalt September 2026',  3250.00,'INCOME'),
  tx(6,  'Netflix Int.',          'Netflix Abo',            -13.99, 'ENTERTAINMENT'),
  tx(7,  'DM Drogeriemarkt',      'Drogerie 15.09.',        -28.55, 'GROCERIES'),
  tx(8,  'MVV Muenchen',          'Monatskarte Sept',       -57.20, 'TRANSPORT'),
  tx(9,  'Amazon EU',             'Bestellung 245-xyz',     -43.98, 'SHOPPING'),
  tx(10, 'REWE SAGT DANKE',       'Einkauf 12.09.',         -82.11, 'GROCERIES'),
  tx(11, 'Lieferando DE',         'Bestellung #88123',      -31.90, 'FOOD_DINING'),
  tx(12, 'Fitnessfirst GmbH',     'Mitgliedschaft Sept',    -29.90, 'HEALTH_FITNESS'),
  tx(13, 'Dr. Mueller Praxis',    'Praxisgebuehr',          -20.00, 'HEALTHCARE'),
  tx(14, 'PENNY MARKT',           'Einkauf 07.09.',         -39.70, 'GROCERIES'),
  tx(15, 'Vodafone GmbH',         'Handyvertrag Sept',      -24.99, 'UTILITIES'),

  // --- Month 1 (~30 days ago) ---
  tx(32, 'REWE SAGT DANKE',       'Einkauf 20.08.',         -71.88, 'GROCERIES'),
  tx(33, 'Arbeitgeber GmbH',      'Gehalt August 2026',     3250.00,'INCOME'),
  tx(34, 'Stadtwerke Muenchen',   'Strom Aug 2026',         -89.00, 'UTILITIES'),
  tx(35, 'Lieferando DE',         'Bestellung #77209',      -26.50, 'FOOD_DINING'),
  tx(36, 'Spotify AB',            'SPOTIFY P1ABC123',       -9.99,  'ENTERTAINMENT'),
  tx(37, 'MVV Muenchen',          'Monatskarte Aug',        -57.20, 'TRANSPORT'),
  tx(38, 'EDEKA CENTER',          'Einkauf 14.08.',         -61.30, 'GROCERIES'),
  tx(39, 'Netflix Int.',          'Netflix Abo',            -13.99, 'ENTERTAINMENT'),
  tx(40, 'Amazon EU',             'Bestellung 246-abc',     -119.00,'SHOPPING'),
  tx(41, 'Fitnessfirst GmbH',     'Mitgliedschaft Aug',     -29.90, 'HEALTH_FITNESS'),
  tx(42, 'ALDI SUED',             'Einkauf 10.08.',         -44.60, 'GROCERIES'),
  tx(43, 'Vodafone GmbH',         'Handyvertrag Aug',       -24.99, 'UTILITIES'),
  tx(44, 'Restaurant Maxvorstadt', 'Tisch fuer 2',          -67.00, 'FOOD_DINING'),
  tx(45, 'DM Drogeriemarkt',      'Drogerie 05.08.',        -19.95, 'GROCERIES'),
  tx(46, 'Miete Verwaltung',      'Warmmiete Aug 2026',     -1100.00,'HOUSING'),

  // --- Month 2 (~60 days ago) ---
  tx(62, 'Arbeitgeber GmbH',      'Gehalt Juli 2026',       3250.00,'INCOME'),
  tx(63, 'Miete Verwaltung',      'Warmmiete Jul 2026',     -1100.00,'HOUSING'),
  tx(64, 'REWE SAGT DANKE',       'Einkauf 22.07.',         -59.40, 'GROCERIES'),
  tx(65, 'Stadtwerke Muenchen',   'Strom Jul 2026',         -89.00, 'UTILITIES'),
  tx(66, 'Spotify AB',            'SPOTIFY P1ABC123',       -9.99,  'ENTERTAINMENT'),
  tx(67, 'MVV Muenchen',          'Monatskarte Jul',        -57.20, 'TRANSPORT'),
  tx(68, 'Lidl',                  'Einkauf 17.07.',         -37.85, 'GROCERIES'),
  tx(69, 'Netflix Int.',          'Netflix Abo',            -13.99, 'ENTERTAINMENT'),
  tx(70, 'Fitnessfirst GmbH',     'Mitgliedschaft Jul',     -29.90, 'HEALTH_FITNESS'),
  tx(71, 'Amazon EU',             'Bestellung 247-def',     -54.99, 'SHOPPING'),
  tx(72, 'Vodafone GmbH',         'Handyvertrag Jul',       -24.99, 'UTILITIES'),
  tx(73, 'Flixbus GmbH',          'Berlin 23.07.',          -28.99, 'TRANSPORT'),
  tx(74, 'EDEKA CENTER',          'Einkauf 08.07.',         -66.20, 'GROCERIES'),
  tx(75, 'Freelance Kunde AG',    'Rechnung #2026-07',      850.00, 'INCOME'),
  tx(76, 'Apotheke am Dom',       'Medikamente',            -34.60, 'HEALTHCARE'),

  // --- Month 3 (~90 days ago) ---
  tx(93, 'Arbeitgeber GmbH',      'Gehalt Juni 2026',       3250.00,'INCOME'),
  tx(94, 'Miete Verwaltung',      'Warmmiete Jun 2026',     -1100.00,'HOUSING'),
  tx(95, 'REWE SAGT DANKE',       'Einkauf 18.06.',         -74.10, 'GROCERIES'),
  tx(96, 'Stadtwerke Muenchen',   'Strom Jun 2026',         -89.00, 'UTILITIES'),
  tx(97, 'Spotify AB',            'SPOTIFY P1ABC123',       -9.99,  'ENTERTAINMENT'),
  tx(98, 'MVV Muenchen',          'Monatskarte Jun',        -57.20, 'TRANSPORT'),
  tx(99, 'Netflix Int.',          'Netflix Abo',            -13.99, 'ENTERTAINMENT'),
  tx(100,'Fitnessfirst GmbH',     'Mitgliedschaft Jun',     -29.90, 'HEALTH_FITNESS'),
  tx(101,'Vodafone GmbH',         'Handyvertrag Jun',       -24.99, 'UTILITIES'),
  tx(102,'ALDI SUED',             'Einkauf 10.06.',         -51.30, 'GROCERIES'),
  tx(103,'Amazon EU',             'Bestellung 248-ghi',     -79.95, 'SHOPPING'),
  tx(104,'Lieferando DE',         'Bestellung #66001',      -22.90, 'FOOD_DINING'),
  tx(105,'Zalando SE',            'Bestellung Online',      -94.95, 'SHOPPING'),
  tx(106,'DM Drogeriemarkt',      'Drogerie 04.06.',        -31.80, 'GROCERIES'),
  tx(107,'Steuerberater Huber',   'Jahresabschluss',        -250.00,'SERVICES'),

  // --- Month 4 (~120 days ago) ---
  tx(123,'Arbeitgeber GmbH',      'Gehalt Mai 2026',        3250.00,'INCOME'),
  tx(124,'Miete Verwaltung',      'Warmmiete Mai 2026',     -1100.00,'HOUSING'),
  tx(125,'REWE SAGT DANKE',       'Einkauf 20.05.',         -68.55, 'GROCERIES'),
  tx(126,'Stadtwerke Muenchen',   'Strom Mai 2026',         -89.00, 'UTILITIES'),
  tx(127,'Spotify AB',            'SPOTIFY P1ABC123',       -9.99,  'ENTERTAINMENT'),
  tx(128,'MVV Muenchen',          'Monatskarte Mai',        -57.20, 'TRANSPORT'),
  tx(129,'Netflix Int.',          'Netflix Abo',            -13.99, 'ENTERTAINMENT'),
  tx(130,'Fitnessfirst GmbH',     'Mitgliedschaft Mai',     -29.90, 'HEALTH_FITNESS'),
  tx(131,'Vodafone GmbH',         'Handyvertrag Mai',       -24.99, 'UTILITIES'),
  tx(132,'EDEKA CENTER',          'Einkauf 14.05.',         -58.70, 'GROCERIES'),
  tx(133,'Freelance Kunde AG',    'Rechnung #2026-05',      650.00, 'INCOME'),
  tx(134,'Amazon EU',             'Bestellung 249-jkl',     -32.99, 'SHOPPING'),
  tx(135,'Restaurant Schwabing',  'Dinner Birthday',        -88.00, 'FOOD_DINING'),
  tx(136,'Lidl',                  'Einkauf 06.05.',         -42.15, 'GROCERIES'),
  tx(137,'Dr. Mueller Praxis',    'Zahnarzt',               -85.00, 'HEALTHCARE'),

  // --- Month 5 (~150 days ago) ---
  tx(153,'Arbeitgeber GmbH',      'Gehalt April 2026',      3250.00,'INCOME'),
  tx(154,'Miete Verwaltung',      'Warmmiete Apr 2026',     -1100.00,'HOUSING'),
  tx(155,'REWE SAGT DANKE',       'Einkauf 16.04.',         -63.80, 'GROCERIES'),
  tx(156,'Stadtwerke Muenchen',   'Strom Apr 2026',         -89.00, 'UTILITIES'),
  tx(157,'Spotify AB',            'SPOTIFY P1ABC123',       -9.99,  'ENTERTAINMENT'),
  tx(158,'MVV Muenchen',          'Monatskarte Apr',        -57.20, 'TRANSPORT'),
  tx(159,'Netflix Int.',          'Netflix Abo',            -13.99, 'ENTERTAINMENT'),
  tx(160,'Fitnessfirst GmbH',     'Mitgliedschaft Apr',     -29.90, 'HEALTH_FITNESS'),
  tx(161,'Vodafone GmbH',         'Handyvertrag Apr',       -24.99, 'UTILITIES'),
  tx(162,'ALDI SUED',             'Einkauf 10.04.',         -47.60, 'GROCERIES'),
  tx(163,'Amazon EU',             'Bestellung 250-mno',     -145.00,'SHOPPING'),
  tx(164,'Lieferando DE',         'Bestellung #55887',      -34.70, 'FOOD_DINING'),
  tx(165,'DM Drogeriemarkt',      'Drogerie 03.04.',        -22.45, 'GROCERIES'),
  tx(166,'Steuererstattung',      'Einkommensteuer 2025',   1240.00,'INCOME'),
  tx(167,'Flixbus GmbH',          'Hamburg 19.04.',         -24.99, 'TRANSPORT'),
];

export const DEMO_ACCOUNT = {
  balance: 4823.67,
  iban: 'DE89 3704 0044 0532 0130 00',
  name: 'Demo Girokonto',
};

export function loadDemoData() {
  const credentials = {
    account: DEMO_ACCOUNT,
  };
  localStorage.setItem('dkb_credentials', JSON.stringify(credentials));
  localStorage.setItem('dkb_transactions', JSON.stringify(DEMO_TRANSACTIONS));
  localStorage.setItem('dkb_last_sync', new Date().toISOString());
}
