import { DatabaseSync } from 'node:sqlite';
import { recalculateProviderRating } from './db.ts';
import { hashPassword } from './security.ts';

const IMAGES = {
  hero: '/src/assets/images/hero_local_craft_1795018254224.jpg',
  plumbing: '/src/assets/images/trade_plumbing_work_1795018254641.jpg',
  electrical: '/src/assets/images/trade_electrical_work_1795018254858.jpg',
  ac: '/src/assets/images/trade_ac_service_1795018254638.jpg',
  carpentry: '/src/assets/images/trade_carpentry_finish_1795018255233.jpg',
};

const CATEGORIES = [
  {
    name: 'Plumbing',
    slug: 'plumbing',
    icon: 'wrench',
    description: 'Pipe leak repair, tap and valve replacement, bathroom fittings, and motor pump servicing.',
  },
  {
    name: 'Electrical',
    slug: 'electrical',
    icon: 'zap',
    description: 'MCB board troubleshooting, inverter installation, ceiling fans, and concealed rewiring.',
  },
  {
    name: 'Cleaning',
    slug: 'cleaning',
    icon: 'sparkles',
    description: 'Full-home deep cleaning, kitchen degreasing, bathroom sanitization, and sofa shampooing.',
  },
  {
    name: 'Painting',
    slug: 'painting',
    icon: 'paintbrush',
    description: 'Interior emulsion, exterior weatherproofing, wall putty, and moisture damp-proofing.',
  },
  {
    name: 'Carpentry',
    slug: 'carpentry',
    icon: 'hammer',
    description: 'Custom wardrobe hinges, modular kitchen repairs, door alignment, and teak wood polishing.',
  },
  {
    name: 'AC Repair',
    slug: 'ac-repair',
    icon: 'wind',
    description: 'Split and window AC foam-jet servicing, gas refilling, PCB repair, and uninstallation.',
  },
  {
    name: 'Tutoring',
    slug: 'tutoring',
    icon: 'book',
    description: 'Home and hybrid coaching for CBSE, ICSE, Mathematics, Physics, and spoken English.',
  },
  {
    name: 'Moving',
    slug: 'moving',
    icon: 'truck',
    description: 'Local household shifting, multi-layer packing, furniture dismantling, and tempo transport.',
  },
  {
    name: 'Appliance Repair',
    slug: 'appliance-repair',
    icon: 'cpu',
    description: 'Front-load washing machine, refrigerator compressor, microwave, and RO purifier repair.',
  },
  {
    name: 'Landscaping',
    slug: 'landscaping',
    icon: 'leaf',
    description: 'Balcony terrace gardens, drip irrigation setup, lawn mowing, and seasonal pruning.',
  },
  {
    name: 'Pest Control',
    slug: 'pest-control',
    icon: 'shield',
    description: 'Odorless gel cockroach treatment, termite barrier drilling, and bed-bug eradication.',
  },
  {
    name: 'Locksmith',
    slug: 'locksmith',
    icon: 'key',
    description: 'Emergency door unlocking, smart mortise lock fitting, and duplicate key cutting.',
  },
];

interface SeedProviderDef {
  email: string;
  ownerName: string;
  phone: string;
  businessName: string;
  categorySlug: string;
  city: string;
  area: string;
  pincode: string;
  lat: number;
  lng: number;
  serviceAreas: string[];
  verified: boolean;
  verificationStatus: 'VERIFIED' | 'PENDING';
  responseMinutes: number;
  yearsExperience: number;
  description: string;
  coverImage: string;
  gallery: string[];
  weekendOpen: boolean;
  todayOpen: boolean;
  services: Array<{
    title: string;
    description: string;
    basePrice: number;
    priceUnit: string;
    durationMinutes: number;
  }>;
}

const PROVIDERS: SeedProviderDef[] = [
  {
    email: 'rajesh.plumbing@example.in',
    ownerName: 'Rajesh Nair',
    phone: '+91 98450 21409',
    businessName: 'Kaveri Precision Plumbing',
    categorySlug: 'plumbing',
    city: 'Bengaluru',
    area: 'Indiranagar',
    pincode: '560038',
    lat: 12.9784,
    lng: 77.6408,
    serviceAreas: ['Indiranagar', 'Domlur', 'Ulsoor', 'HAL 2nd Stage', 'Koramangala'],
    verified: true,
    verificationStatus: 'VERIFIED',
    responseMinutes: 15,
    yearsExperience: 12,
    description:
      'Licensed residential and commercial plumbing team specializing in concealed CPVC/UPVC leak detection, Grohe & Jaquar mixer repairs, and overhead tank pressure pumps.',
    coverImage: IMAGES.plumbing,
    gallery: [IMAGES.plumbing, IMAGES.hero],
    weekendOpen: true,
    todayOpen: true,
    services: [
      { title: 'Tap, Angle Valve & Mixer Repair', description: 'Cartridge replacement, spindle repair, and leak sealing for basin or shower mixers.', basePrice: 349, priceUnit: 'per visit', durationMinutes: 45 },
      { title: 'Concealed Pipe Leak Detection', description: 'Thermal & pressure-gauge inspection to pinpoint damp wall leaks with minimal tile breakage.', basePrice: 899, priceUnit: 'inspection', durationMinutes: 90 },
      { title: 'Booster & Sump Motor Servicing', description: 'Impeller cleaning, capacitor check, and NRV valve replacement for 0.5–1.5 HP pumps.', basePrice: 650, priceUnit: 'per unit', durationMinutes: 75 },
      { title: 'Complete Bathroom Fitting Package', description: 'Installation of WC, health faucet, washbasin, and shower diverter set.', basePrice: 2400, priceUnit: 'per bathroom', durationMinutes: 180 },
    ],
  },
  {
    email: 'priya.electrical@example.in',
    ownerName: 'Priya Kulkarni',
    phone: '+91 98201 55312',
    businessName: 'VoltSafe Electricals',
    categorySlug: 'electrical',
    city: 'Mumbai',
    area: 'Bandra West',
    pincode: '400050',
    lat: 19.0596,
    lng: 72.8295,
    serviceAreas: ['Bandra West', 'Khar', 'Santacruz West', 'Pali Hill', 'Mahim'],
    verified: true,
    verificationStatus: 'VERIFIED',
    responseMinutes: 20,
    yearsExperience: 9,
    description:
      'PWD-certified electrical contractors handling MCB distribution upgrades, phase load balancing, UPS/inverter wiring, and earth-leakage fault diagnostics.',
    coverImage: IMAGES.electrical,
    gallery: [IMAGES.electrical, IMAGES.hero],
    weekendOpen: true,
    todayOpen: true,
    services: [
      { title: 'MCB & RCCB Fault Diagnostics', description: 'Thermal load test and breaker replacement for tripping circuits and short-circuit faults.', basePrice: 449, priceUnit: 'per visit', durationMinutes: 60 },
      { title: 'Inverter & Battery Setup', description: 'Single-battery or double-battery home inverter wiring integrated into main DB.', basePrice: 1200, priceUnit: 'installation', durationMinutes: 120 },
      { title: 'Ceiling Fan & Chandelier Mounting', description: 'Safe anchor-fastener mounting with regulator replacement and balance check.', basePrice: 399, priceUnit: 'per fixture', durationMinutes: 45 },
    ],
  },
  {
    email: 'arjun.hvac@example.in',
    ownerName: 'Arjun Deshmukh',
    phone: '+91 98220 77814',
    businessName: 'Deccan CoolAir HVAC',
    categorySlug: 'ac-repair',
    city: 'Pune',
    area: 'Kothrud',
    pincode: '411038',
    lat: 18.5074,
    lng: 73.8077,
    serviceAreas: ['Kothrud', 'Karve Nagar', 'Erandwane', 'Bavdhan', 'Warje'],
    verified: true,
    verificationStatus: 'VERIFIED',
    responseMinutes: 25,
    yearsExperience: 8,
    description:
      'Split, inverter, and VRV air-conditioning technicians equipped with jacketed foam-jet washers, digital manifold gauges, and R32/R410A refrigerant cylinders.',
    coverImage: IMAGES.ac,
    gallery: [IMAGES.ac, IMAGES.electrical],
    weekendOpen: true,
    todayOpen: true,
    services: [
      { title: 'Foam-Jet Split AC Deep Service', description: 'High-pressure blower coil, drain tray, and outdoor condenser wash with splash guard.', basePrice: 599, priceUnit: 'per AC', durationMinutes: 60 },
      { title: 'Refrigerant Gas Top-Up & Leak Test', description: 'Nitrogen pressure test, flare-nut tightening, and R32/R410A refill.', basePrice: 2200, priceUnit: 'per AC', durationMinutes: 90 },
      { title: 'Split AC Installation / Uninstallation', description: 'Core drilling, copper flare connection, vacuuming, and bracket leveling.', basePrice: 1499, priceUnit: 'per unit', durationMinutes: 120 },
    ],
  },
  {
    email: 'vikram.woodcraft@example.in',
    ownerName: 'Vikram Rathore',
    phone: '+91 98112 64092',
    businessName: 'Rathore Fine Woodcraft',
    categorySlug: 'carpentry',
    city: 'Delhi NCR',
    area: 'Saket',
    pincode: '110017',
    lat: 28.5245,
    lng: 77.2066,
    serviceAreas: ['Saket', 'Malviya Nagar', 'Hauz Khas', 'Panchsheel Park', 'Greater Kailash'],
    verified: true,
    verificationStatus: 'VERIFIED',
    responseMinutes: 35,
    yearsExperience: 15,
    description:
      'Precision residential carpentry for Hettich/Ebco soft-close hinges, sliding wardrobe channels, teak door planing, and bespoke study desks.',
    coverImage: IMAGES.carpentry,
    gallery: [IMAGES.carpentry, IMAGES.hero],
    weekendOpen: false,
    todayOpen: true,
    services: [
      { title: 'Soft-Close Hinge & Drawer Channel Repair', description: 'Replacement of sagging wardrobe hinges and telescopic kitchen drawer runners.', basePrice: 450, priceUnit: 'per visit', durationMinutes: 60 },
      { title: 'Wooden Door Planing & Lock Fitting', description: 'Trims swollen monsoon doors and installs mortise or Aldrop locking hardware.', basePrice: 550, priceUnit: 'per door', durationMinutes: 75 },
      { title: 'Flat-Pack Furniture Assembly', description: 'Complete assembly and wall anchoring for beds, bookshelves, and modular desks.', basePrice: 850, priceUnit: 'per unit', durationMinutes: 120 },
    ],
  },
  {
    email: 'meera.clean@example.in',
    ownerName: 'Meera Krishnan',
    phone: '+91 98401 32910',
    businessName: 'Sparkline Home Hygiene',
    categorySlug: 'cleaning',
    city: 'Chennai',
    area: 'Adyar',
    pincode: '600020',
    lat: 13.0012,
    lng: 80.2565,
    serviceAreas: ['Adyar', 'Besant Nagar', 'Thiruvanmiyur', 'Kotturpuram', 'Guindy'],
    verified: true,
    verificationStatus: 'VERIFIED',
    responseMinutes: 30,
    yearsExperience: 7,
    description:
      'Eco-safe residential deep cleaning crew with industrial single-disc floor scrubbers, steam sanitizers, and food-safe kitchen degreasers.',
    coverImage: IMAGES.hero,
    gallery: [IMAGES.hero, IMAGES.carpentry],
    weekendOpen: true,
    todayOpen: true,
    services: [
      { title: '2 BHK Full Home Deep Cleaning', description: '4-person crew covering floor scrubbing, bathrooms, kitchen cabinets, windows, and balconies.', basePrice: 3699, priceUnit: 'flat', durationMinutes: 300 },
      { title: 'Kitchen Chimney & Tile Degreasing', description: 'Deep removal of grease buildup across hob, hood filters, backsplash, and loft.', basePrice: 1299, priceUnit: 'per kitchen', durationMinutes: 120 },
      { title: 'Bathroom Hard-Water Descaling', description: 'Glass partition descaling, grout scrubbing, and fixture polishing for 2 bathrooms.', basePrice: 899, priceUnit: 'for 2 baths', durationMinutes: 90 },
    ],
  },
  {
    email: 'suresh.paints@example.in',
    ownerName: 'Suresh Reddy',
    phone: '+91 98490 88211',
    businessName: 'Charminar Coat & Finish',
    categorySlug: 'painting',
    city: 'Hyderabad',
    area: 'Jubilee Hills',
    pincode: '500033',
    lat: 17.4326,
    lng: 78.4071,
    serviceAreas: ['Jubilee Hills', 'Banjara Hills', 'Madhapur', 'Film Nagar', 'Kondapur'],
    verified: true,
    verificationStatus: 'VERIFIED',
    responseMinutes: 45,
    yearsExperience: 14,
    description:
      'Dust-free mechanized wall sanding, Asian Paints Royale & Apex Ultima applicators, and terrace waterproofing specialists.',
    coverImage: IMAGES.carpentry,
    gallery: [IMAGES.carpentry],
    weekendOpen: true,
    todayOpen: false,
    services: [
      { title: 'Single Room Repainting (Labor + Putty Touchup)', description: 'Surface masking, two coats of acrylic emulsion, and spotless post-paint cleanup.', basePrice: 3200, priceUnit: 'per room', durationMinutes: 360 },
      { title: 'Damp Wall Waterproofing Treatment', description: 'Moisture meter check, crack filling, and 2-coat elastomeric damp-block primer.', basePrice: 2450, priceUnit: 'per wall', durationMinutes: 240 },
    ],
  },
  {
    email: 'karthik.tutor@example.in',
    ownerName: 'Karthik Subramanian',
    phone: '+91 99001 44519',
    businessName: 'Axiom STEM Home Tutors',
    categorySlug: 'tutoring',
    city: 'Bengaluru',
    area: 'Koramangala',
    pincode: '560034',
    lat: 12.9352,
    lng: 77.6245,
    serviceAreas: ['Koramangala', 'HSR Layout', 'BTM Layout', 'Jayanagar', 'Indiranagar'],
    verified: true,
    verificationStatus: 'VERIFIED',
    responseMinutes: 20,
    yearsExperience: 10,
    description:
      'IIT-BHU alumnus offering structured 1-on-1 home and hybrid tutoring for Class 9–12 CBSE/ICSE Mathematics, Physics, and JEE foundation.',
    coverImage: IMAGES.hero,
    gallery: [IMAGES.hero],
    weekendOpen: true,
    todayOpen: true,
    services: [
      { title: 'Diagnostic Assessment & Trial Session', description: '90-minute concept evaluation and customized 12-week study plan.', basePrice: 600, priceUnit: 'per session', durationMinutes: 90 },
      { title: 'Class 10–12 Math & Physics (Monthly Pack)', description: '12 in-home sessions per month with weekly chapter tests and worksheet reviews.', basePrice: 6500, priceUnit: 'per month', durationMinutes: 90 },
    ],
  },
  {
    email: 'deepak.movers@example.in',
    ownerName: 'Deepak Sharma',
    phone: '+91 98180 99321',
    businessName: 'SafeHaul Packers & Movers',
    categorySlug: 'moving',
    city: 'Delhi NCR',
    area: 'Indirapuram',
    pincode: '201014',
    lat: 28.6415,
    lng: 77.3714,
    serviceAreas: ['Indirapuram', 'Noida Sector 62', 'Vaishali', 'Mayur Vihar', 'South Delhi'],
    verified: true,
    verificationStatus: 'VERIFIED',
    responseMinutes: 30,
    yearsExperience: 11,
    description:
      'In-city household relocation with 5-ply corrugated boxes, bubble-wrap appliance crating, carpenter dismantling, and closed-body Tata Ace / 14ft trucks.',
    coverImage: IMAGES.carpentry,
    gallery: [IMAGES.carpentry],
    weekendOpen: true,
    todayOpen: true,
    services: [
      { title: '1 BHK Local Shifting (Same City)', description: 'Packing material, 3 loaders, appliance wrapping, and closed-container transport within 15 km.', basePrice: 4200, priceUnit: 'per move', durationMinutes: 240 },
      { title: '2 BHK Complete Relocation', description: '4-person crew, wardrobe boxes, bed dismantling/reassembly, and insured transit.', basePrice: 6800, priceUnit: 'per move', durationMinutes: 360 },
    ],
  },
  {
    email: 'farhan.appliances@example.in',
    ownerName: 'Farhan Siddiqui',
    phone: '+91 98204 71829',
    businessName: 'MetroTech Appliance Care',
    categorySlug: 'appliance-repair',
    city: 'Mumbai',
    area: 'Powai',
    pincode: '400076',
    lat: 19.1176,
    lng: 72.9060,
    serviceAreas: ['Powai', 'Chandivali', 'Vikhroli', 'Ghatkopar', 'Andheri East'],
    verified: true,
    verificationStatus: 'VERIFIED',
    responseMinutes: 18,
    yearsExperience: 9,
    description:
      'Multi-brand repair for Bosch, LG, IFB, and Samsung front-load washing machines, frost-free refrigerators, and inverter microwaves using OEM spares.',
    coverImage: IMAGES.electrical,
    gallery: [IMAGES.electrical, IMAGES.ac],
    weekendOpen: true,
    todayOpen: true,
    services: [
      { title: 'Washing Machine Diagnostic & Drain Repair', description: 'Drum bearing check, inlet solenoid replacement, and drain pump cleaning.', basePrice: 399, priceUnit: 'inspection', durationMinutes: 60 },
      { title: 'Refrigerator Cooling & Relay Service', description: 'Thermostat calibration, overload relay testing, and defrost heater replacement.', basePrice: 499, priceUnit: 'inspection', durationMinutes: 60 },
      { title: 'RO Water Purifier Filter Kit Overhaul', description: 'Sediment, pre-carbon, and RO membrane replacement with TDS testing.', basePrice: 1850, priceUnit: 'kit + labor', durationMinutes: 60 },
    ],
  },
  {
    email: 'nandini.gardens@example.in',
    ownerName: 'Nandini Rao',
    phone: '+91 99802 15388',
    businessName: 'Verdant Balcony & Lawn',
    categorySlug: 'landscaping',
    city: 'Bengaluru',
    area: 'Whitefield',
    pincode: '560066',
    lat: 12.9698,
    lng: 77.7500,
    serviceAreas: ['Whitefield', 'Brookefield', 'Marathahalli', 'Varthur', 'KR Puram'],
    verified: true,
    verificationStatus: 'VERIFIED',
    responseMinutes: 50,
    yearsExperience: 6,
    description:
      'Urban terrace garden setup, automated drip irrigation timers, organic potting-mix repotting, and villa lawn maintenance.',
    coverImage: IMAGES.hero,
    gallery: [IMAGES.hero],
    weekendOpen: true,
    todayOpen: false,
    services: [
      { title: 'Balcony Garden Cleanup & Repotting', description: 'Pruning, cocopeat + vermicompost top-up, and neem-oil pest care for up to 15 pots.', basePrice: 1199, priceUnit: 'per visit', durationMinutes: 120 },
      { title: 'Automated Drip Irrigation Setup', description: 'Timer valve and micro-dripper installation for 20–30 balcony planters.', basePrice: 2800, priceUnit: 'complete kit', durationMinutes: 150 },
    ],
  },
  {
    email: 'manoj.pest@example.in',
    ownerName: 'Manoj Tiwari',
    phone: '+91 98231 44019',
    businessName: 'ShieldGuard Pest Solutions',
    categorySlug: 'pest-control',
    city: 'Pune',
    area: 'Baner',
    pincode: '411045',
    lat: 18.5590,
    lng: 73.7868,
    serviceAreas: ['Baner', 'Balewadi', 'Aundh', 'Wakad', 'Pashan'],
    verified: true,
    verificationStatus: 'VERIFIED',
    responseMinutes: 25,
    yearsExperience: 10,
    description:
      'CIBRC-approved Bayer gel cockroach control, odorless ant/silverfish spray, and drill-fill-seal anti-termite treatments with 6-month service warranty.',
    coverImage: IMAGES.plumbing,
    gallery: [IMAGES.plumbing],
    weekendOpen: true,
    todayOpen: true,
    services: [
      { title: 'Odorless Cockroach & Ant Gel Treatment (2 BHK)', description: 'No kitchen emptying required; safe for pets and children.', basePrice: 999, priceUnit: '2 BHK', durationMinutes: 60 },
      { title: 'Anti-Termite Drill & Seal Treatment', description: 'Wall skirting injection along door frames and wooden wardrobes.', basePrice: 3499, priceUnit: '2 BHK', durationMinutes: 180 },
    ],
  },
  {
    email: 'harish.locks@example.in',
    ownerName: 'Harish Verma',
    phone: '+91 98103 28477',
    businessName: 'KeyCraft 24x7 Locksmith',
    categorySlug: 'locksmith',
    city: 'Delhi NCR',
    area: 'Gurgaon DLF Phase 4',
    pincode: '122002',
    lat: 28.4675,
    lng: 77.0815,
    serviceAreas: ['DLF Phase 1-4', 'Sushant Lok', 'MG Road', 'Golf Course Road', 'South City'],
    verified: true,
    verificationStatus: 'VERIFIED',
    responseMinutes: 12,
    yearsExperience: 13,
    description:
      'Non-destructive emergency door opening, Yale & Godrej biometric digital lock installation, and car transponder key programming.',
    coverImage: IMAGES.carpentry,
    gallery: [IMAGES.carpentry],
    weekendOpen: true,
    todayOpen: true,
    services: [
      { title: 'Emergency Non-Destructive Door Unlock', description: 'Damage-free unlocking for jammed Godrej, Europa, or mortise latches.', basePrice: 650, priceUnit: 'per visit', durationMinutes: 30 },
      { title: 'Smart Digital Door Lock Installation', description: 'Precision wooden/metal door routing for biometric & PIN smart locks.', basePrice: 1499, priceUnit: 'per lock', durationMinutes: 90 },
    ],
  },
  {
    email: 'sandeep.pipes@example.in',
    ownerName: 'Sandeep Gowda',
    phone: '+91 99860 54120',
    businessName: 'Namma Pipe & Sanitary Works',
    categorySlug: 'plumbing',
    city: 'Bengaluru',
    area: 'HSR Layout',
    pincode: '560102',
    lat: 12.9121,
    lng: 77.6446,
    serviceAreas: ['HSR Layout', 'Bellandur', 'Koramangala', 'Sarjapur Road', 'Bommanahalli'],
    verified: true,
    verificationStatus: 'VERIFIED',
    responseMinutes: 22,
    yearsExperience: 8,
    description:
      'Fast dispatch plumbing crew for blocked kitchen sinks, western toilet cistern repairs, geyser inlet piping, and overhead tank cleaning.',
    coverImage: IMAGES.plumbing,
    gallery: [IMAGES.plumbing, IMAGES.hero],
    weekendOpen: true,
    todayOpen: true,
    services: [
      { title: 'Kitchen Sink & Floor Drain Desilting', description: 'High-pressure jetting and trap cleaning for slow or blocked drains.', basePrice: 449, priceUnit: 'per drain', durationMinutes: 45 },
      { title: 'Concealed Cistern & Flush Valve Repair', description: 'Geberit/Jaquar concealed tank diaphragm and dual-flush mechanism repair.', basePrice: 699, priceUnit: 'per unit', durationMinutes: 60 },
    ],
  },
  {
    email: 'amit.volt@example.in',
    ownerName: 'Amitabh Joshi',
    phone: '+91 98230 91244',
    businessName: 'Sahyadri Power & Earthing',
    categorySlug: 'electrical',
    city: 'Pune',
    area: 'Viman Nagar',
    pincode: '411014',
    lat: 18.5679,
    lng: 73.9143,
    serviceAreas: ['Viman Nagar', 'Kalyani Nagar', 'Kharadi', 'Koregaon Park', 'Yerwada'],
    verified: true,
    verificationStatus: 'VERIFIED',
    responseMinutes: 28,
    yearsExperience: 11,
    description:
      'Residential EV charger socket installation, smart Wi-Fi switchboards, geyser power points, and copper earthing pit testing.',
    coverImage: IMAGES.electrical,
    gallery: [IMAGES.electrical],
    weekendOpen: false,
    todayOpen: true,
    services: [
      { title: '16A Heavy Appliance / Geyser Point Wiring', description: 'Dedicated 2.5 sqmm Finolex copper line with 20A DP switch and socket.', basePrice: 550, priceUnit: 'per point', durationMinutes: 60 },
      { title: 'Home EV Scooter Charger Point Setup', description: 'Weatherproof IP65 industrial socket with dedicated 16A MCB.', basePrice: 1350, priceUnit: 'installation', durationMinutes: 90 },
    ],
  },
  {
    email: 'kavya.ac@example.in',
    ownerName: 'Kavya Nair',
    phone: '+91 98492 61033',
    businessName: 'Breezeway Climate Tech',
    categorySlug: 'ac-repair',
    city: 'Hyderabad',
    area: 'Madhapur',
    pincode: '500081',
    lat: 17.4483,
    lng: 78.3915,
    serviceAreas: ['Madhapur', 'Gachibowli', 'Kondapur', 'Hitech City', 'Kukatpally'],
    verified: true,
    verificationStatus: 'VERIFIED',
    responseMinutes: 19,
    yearsExperience: 7,
    description:
      'Inverter AC PCB diagnostics, copper line replacement, drain-pipe water leakage fixes, and annual maintenance contracts for apartments.',
    coverImage: IMAGES.ac,
    gallery: [IMAGES.ac],
    weekendOpen: true,
    todayOpen: true,
    services: [
      { title: 'AC Water Leakage & Drain Flush', description: 'Pressurized nitrogen drain-line clearing and indoor unit level adjustment.', basePrice: 499, priceUnit: 'per AC', durationMinutes: 45 },
      { title: '2-AC Annual Maintenance Service Pack', description: '2 wet foam-jet services + 1 dry checkup across 12 months.', basePrice: 1999, priceUnit: 'annual pack', durationMinutes: 90 },
    ],
  },
  {
    email: 'rohit.clean@example.in',
    ownerName: 'Rohit Salunkhe',
    phone: '+91 98209 34812',
    businessName: 'HarborFresh Deep Clean',
    categorySlug: 'cleaning',
    city: 'Mumbai',
    area: 'Andheri West',
    pincode: '400053',
    lat: 19.1363,
    lng: 72.8277,
    serviceAreas: ['Andheri West', 'Versova', 'Juhu', 'Lokhandwala', 'Goregaon West'],
    verified: true,
    verificationStatus: 'VERIFIED',
    responseMinutes: 35,
    yearsExperience: 6,
    description:
      'Injection-extraction fabric sofa shampooing, mattress UV vacuuming, and move-in/move-out apartment sanitization across western suburbs.',
    coverImage: IMAGES.hero,
    gallery: [IMAGES.hero],
    weekendOpen: true,
    todayOpen: true,
    services: [
      { title: '5-Seater Sofa Shampoo & Extraction', description: 'Foam brushing, stain spotting, and wet vacuum extraction for quick drying.', basePrice: 899, priceUnit: '5 seats', durationMinutes: 90 },
      { title: '1 BHK Vacant Flat Move-In Cleaning', description: 'Complete floor polish, bathroom descaling, and wardrobe wiping.', basePrice: 2599, priceUnit: 'flat', durationMinutes: 210 },
    ],
  },
  {
    email: 'naveen.carpenter@example.in',
    ownerName: 'Naveen Acharya',
    phone: '+91 98410 77290',
    businessName: 'Madras Joinery Works',
    categorySlug: 'carpentry',
    city: 'Chennai',
    area: 'Anna Nagar',
    pincode: '600040',
    lat: 13.0850,
    lng: 80.2101,
    serviceAreas: ['Anna Nagar', 'Kilpauk', 'Mogappair', 'Shenoy Nagar', 'Nungambakkam'],
    verified: true,
    verificationStatus: 'VERIFIED',
    responseMinutes: 40,
    yearsExperience: 16,
    description:
      'Traditional teak wood restoration, termite-damaged frame replacement, mosquito mesh sliding doors, and kitchen loft shutter installation.',
    coverImage: IMAGES.carpentry,
    gallery: [IMAGES.carpentry],
    weekendOpen: false,
    todayOpen: true,
    services: [
      { title: 'Mosquito Mesh Door Frame Fitting', description: 'Custom-sized pleated or hinged aluminum/wood mesh frames for balconies.', basePrice: 1800, priceUnit: 'per door', durationMinutes: 120 },
      { title: 'General Carpentry Hourly Fix', description: 'Curtain rod drilling, wall shelf anchoring, and hinge adjustments.', basePrice: 399, priceUnit: 'first hour', durationMinutes: 60 },
    ],
  },
  {
    email: 'anita.paints@example.in',
    ownerName: 'Anita Deshpande',
    phone: '+91 98455 83102',
    businessName: 'BrushLine Studio Painters',
    categorySlug: 'painting',
    city: 'Bengaluru',
    area: 'Jayanagar',
    pincode: '560041',
    lat: 12.9250,
    lng: 77.5938,
    serviceAreas: ['Jayanagar', 'JP Nagar', 'Basavanagudi', 'Banashankari', 'BTM Layout'],
    verified: true,
    verificationStatus: 'VERIFIED',
    responseMinutes: 40,
    yearsExperience: 9,
    description:
      'On-time apartment repainting with furniture plastic sheeting, low-VOC matte emulsions, and wood melamine spray finishing.',
    coverImage: IMAGES.carpentry,
    gallery: [IMAGES.carpentry],
    weekendOpen: true,
    todayOpen: false,
    services: [
      { title: 'Full 2 BHK Interior Repainting', description: 'Crack putty repair + 2 coats washable emulsion with floor protection.', basePrice: 12500, priceUnit: '2 BHK', durationMinutes: 480 },
      { title: 'Accent Texture / Limewash Wall', description: 'Single feature wall surface preparation and architectural texture finish.', basePrice: 4200, priceUnit: 'per wall', durationMinutes: 240 },
    ],
  },
  {
    email: 'prashant.appliance@example.in',
    ownerName: 'Prashant Iyer',
    phone: '+91 98404 99123',
    businessName: 'Coromandel Appliance Repair',
    categorySlug: 'appliance-repair',
    city: 'Chennai',
    area: 'Velachery',
    pincode: '600042',
    lat: 12.9756,
    lng: 80.2207,
    serviceAreas: ['Velachery', 'Pallikaranai', 'Guindy', 'Adyar', 'Taramani'],
    verified: true,
    verificationStatus: 'VERIFIED',
    responseMinutes: 24,
    yearsExperience: 10,
    description:
      'Same-day doorstep repair for dishwashers, front-load washers, induction cooktops, and RO + UV water purifiers with 90-day spare warranty.',
    coverImage: IMAGES.electrical,
    gallery: [IMAGES.electrical],
    weekendOpen: true,
    todayOpen: true,
    services: [
      { title: 'Dishwasher Heating & Spray Arm Repair', description: 'Circulation pump cleaning, salt-reservoir check, and thermostat testing.', basePrice: 499, priceUnit: 'inspection', durationMinutes: 60 },
      { title: 'Microwave Magnetron & Touchpad Fix', description: 'High-voltage diode, capacitor, and membrane keypad replacement.', basePrice: 449, priceUnit: 'inspection', durationMinutes: 45 },
    ],
  },
  {
    email: 'rahul.pest@example.in',
    ownerName: 'Rahul Kulkarni',
    phone: '+91 98495 22018',
    businessName: 'Deccan BioPest Control',
    categorySlug: 'pest-control',
    city: 'Hyderabad',
    area: 'Gachibowli',
    pincode: '500032',
    lat: 17.4401,
    lng: 78.3489,
    serviceAreas: ['Gachibowli', 'Kondapur', 'Nanakramguda', 'Manikonda', 'Madhapur'],
    verified: true,
    verificationStatus: 'VERIFIED',
    responseMinutes: 30,
    yearsExperience: 8,
    description:
      'WHO-certified herbal and low-odor pest control for apartments, gated villas, and home kitchens covering cockroaches, mosquitoes, and rodents.',
    coverImage: IMAGES.plumbing,
    gallery: [IMAGES.plumbing],
    weekendOpen: true,
    todayOpen: true,
    services: [
      { title: 'Complete 3 BHK Pest Shield', description: 'Gel baiting + perimeter spray covering kitchen, bathrooms, and utility.', basePrice: 1299, priceUnit: '3 BHK', durationMinutes: 75 },
      { title: 'Bed-Bug 2-Visit Herbal Eradication', description: 'Thorough mattress, headboard, and skirting treatment with 15-day follow-up.', basePrice: 2199, priceUnit: '2 BHK', durationMinutes: 120 },
    ],
  },
  {
    email: 'shreya.tutor@example.in',
    ownerName: 'Shreya Chatterjee',
    phone: '+91 98207 11890',
    businessName: 'Meridian English & Humanities',
    categorySlug: 'tutoring',
    city: 'Mumbai',
    area: 'Dadar West',
    pincode: '400028',
    lat: 19.0178,
    lng: 72.8478,
    serviceAreas: ['Dadar', 'Matunga', 'Lower Parel', 'Prabhadevi', 'Mahim'],
    verified: true,
    verificationStatus: 'VERIFIED',
    responseMinutes: 45,
    yearsExperience: 8,
    description:
      'Academic writing, IB/IGCSE English Literature, and business communication coaching tailored for school students and working professionals.',
    coverImage: IMAGES.hero,
    gallery: [IMAGES.hero],
    weekendOpen: true,
    todayOpen: false,
    services: [
      { title: '1-on-1 Essay & Grammar Diagnostic', description: 'Structured comprehension and writing assessment with feedback rubric.', basePrice: 750, priceUnit: 'per hour', durationMinutes: 60 },
      { title: 'IGCSE / IB English Weekly Coaching', description: '8 structured sessions per month with graded mock papers.', basePrice: 5800, priceUnit: 'per month', durationMinutes: 75 },
    ],
  },
  {
    email: 'vijay.movers@example.in',
    ownerName: 'Vijay Patil',
    phone: '+91 98451 66402',
    businessName: 'MetroLine Express Shifting',
    categorySlug: 'moving',
    city: 'Bengaluru',
    area: 'Yelahanka',
    pincode: '560064',
    lat: 13.1007,
    lng: 77.5963,
    serviceAreas: ['Yelahanka', 'Hebbal', 'Sahakara Nagar', 'Jakur', 'Malleshwaram'],
    verified: true,
    verificationStatus: 'VERIFIED',
    responseMinutes: 35,
    yearsExperience: 9,
    description:
      'Punctual apartment and studio office shifting with GPS-tracked closed vans, stretch-film sofa protection, and fixed upfront quotes.',
    coverImage: IMAGES.carpentry,
    gallery: [IMAGES.carpentry],
    weekendOpen: true,
    todayOpen: true,
    services: [
      { title: 'Studio / 1 RK Mini-Shift', description: 'Tempo van + 2 helpers for quick local moves within 10 km.', basePrice: 2900, priceUnit: 'per move', durationMinutes: 150 },
      { title: '2 BHK Premium Packing & Move', description: 'Bubble wrap, carton boxes, TV crating, and 4 trained movers.', basePrice: 6400, priceUnit: 'per move', durationMinutes: 330 },
    ],
  },
  // 4 Pending Verification providers so Admin Moderation Queue is immediately useful!
  {
    email: 'kiran.plumb.pending@example.in',
    ownerName: 'Kiran Bhosale',
    phone: '+91 98229 10293',
    businessName: 'Bhosale Hydro Solutions',
    categorySlug: 'plumbing',
    city: 'Pune',
    area: 'Wakad',
    pincode: '411057',
    lat: 18.5987,
    lng: 73.7610,
    serviceAreas: ['Wakad', 'Hinjewadi', 'Pimple Saudagar', 'Baner'],
    verified: false,
    verificationStatus: 'PENDING',
    responseMinutes: 30,
    yearsExperience: 4,
    description:
      'Residential solar water heater piping, bathroom waterproofing grouting, and pressure pump repairs across Pimpri-Chinchwad.',
    coverImage: IMAGES.plumbing,
    gallery: [IMAGES.plumbing],
    weekendOpen: true,
    todayOpen: true,
    services: [
      { title: 'Solar Water Heater Valve & Pipe Service', description: 'Air-vent valve replacement and hot-water CPVC joint sealing.', basePrice: 550, priceUnit: 'per visit', durationMinutes: 60 },
      { title: 'Bathroom Epoxy Grouting', description: 'Anti-fungal tile joint refilling for wet zones and shower corners.', basePrice: 1450, priceUnit: 'per bathroom', durationMinutes: 150 },
    ],
  },
  {
    email: 'tarun.elec.pending@example.in',
    ownerName: 'Tarun Malhotra',
    phone: '+91 98118 45012',
    businessName: 'Malhotra Smart Wiring',
    categorySlug: 'electrical',
    city: 'Delhi NCR',
    area: 'Dwarka Sector 12',
    pincode: '110078',
    lat: 28.5921,
    lng: 77.0460,
    serviceAreas: ['Dwarka', 'Janakpuri', 'Vikas Puri', 'Palam'],
    verified: false,
    verificationStatus: 'PENDING',
    responseMinutes: 25,
    yearsExperience: 5,
    description:
      'Smart home relay installation, recessed LED ceiling profiles, and residential stabilizer wiring in West Delhi.',
    coverImage: IMAGES.electrical,
    gallery: [IMAGES.electrical],
    weekendOpen: true,
    todayOpen: true,
    services: [
      { title: 'Smart Switch Module Retrofit', description: 'Wi-Fi 4-node switchboard installation behind existing modular plates.', basePrice: 699, priceUnit: 'per board', durationMinutes: 60 },
      { title: 'Main Stabilizer & Surge Protector Setup', description: 'Voltage protection wiring for entire 3 BHK main supply.', basePrice: 1100, priceUnit: 'installation', durationMinutes: 90 },
    ],
  },
  {
    email: 'geeta.clean.pending@example.in',
    ownerName: 'Geeta Nair',
    phone: '+91 98498 33104',
    businessName: 'Pristine Space Crew',
    categorySlug: 'cleaning',
    city: 'Hyderabad',
    area: 'Kondapur',
    pincode: '500084',
    lat: 17.4622,
    lng: 78.3568,
    serviceAreas: ['Kondapur', 'Miyapur', 'Madhapur', 'Gachibowli'],
    verified: false,
    verificationStatus: 'PENDING',
    responseMinutes: 40,
    yearsExperience: 3,
    description:
      'Dedicated apartment deep cleaning and post-renovation dust removal crew serving IT corridor apartments.',
    coverImage: IMAGES.hero,
    gallery: [IMAGES.hero],
    weekendOpen: true,
    todayOpen: false,
    services: [
      { title: 'Post-Carpentry Dust Removal (2 BHK)', description: 'HEPA vacuuming of wardrobes, window tracks, and tile floors.', basePrice: 3200, priceUnit: 'flat', durationMinutes: 240 },
    ],
  },
  {
    email: 'selvam.lock.pending@example.in',
    ownerName: 'Selvam Murugan',
    phone: '+91 98409 88712',
    businessName: 'Aegis Key & Lock Care',
    categorySlug: 'locksmith',
    city: 'Chennai',
    area: 'T Nagar',
    pincode: '600017',
    lat: 13.0418,
    lng: 80.2341,
    serviceAreas: ['T Nagar', 'Mylapore', 'Nungambakkam', 'Alwarpet'],
    verified: false,
    verificationStatus: 'PENDING',
    responseMinutes: 20,
    yearsExperience: 6,
    description:
      'High-security dimple-key lock cylinder replacements, steel almirah unlocking, and main door shutter bolts.',
    coverImage: IMAGES.carpentry,
    gallery: [IMAGES.carpentry],
    weekendOpen: true,
    todayOpen: true,
    services: [
      { title: 'Night Latch & Cylinder Replacement', description: 'Re-keying or swapping main door Godrej/Yale cylinder.', basePrice: 499, priceUnit: 'labor', durationMinutes: 45 },
    ],
  },
];

export function seedDatabaseIfEmpty(db: DatabaseSync): void {
  const existingUsers = db.prepare(`SELECT COUNT(*) as c FROM users`).get() as { c: number };
  if (Number(existingUsers.c) > 0) {
    return;
  }

  const insertCat = db.prepare(
    `INSERT INTO service_categories (name, slug, icon, description, sort_order) VALUES (?, ?, ?, ?, ?)`,
  );
  const categoryIdBySlug = new Map<string, number>();
  CATEGORIES.forEach((cat, idx) => {
    const res = insertCat.run(cat.name, cat.slug, cat.icon, cat.description, idx + 1);
    categoryIdBySlug.set(cat.slug, Number(res.lastInsertRowid));
  });

  const insertUser = db.prepare(
    `INSERT INTO users (full_name, email, password_hash, phone, city, area, role) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );

  // Seed Demo Customer & Admin Accounts
  const customerPass = hashPassword('Customer@123');
  const providerPass = hashPassword('Provider@123');
  const adminPass = hashPassword('Admin@123');

  const ananyaId = Number(
    insertUser.run('Ananya Sharma', 'ananya.sharma@example.in', customerPass, '+91 98801 44210', 'Bengaluru', 'Indiranagar', 'CUSTOMER')
      .lastInsertRowid,
  );
  const rohanId = Number(
    insertUser.run('Rohan Mehta', 'rohan.mehta@example.in', customerPass, '+91 98205 61904', 'Mumbai', 'Bandra West', 'CUSTOMER')
      .lastInsertRowid,
  );
  const kavitaId = Number(
    insertUser.run('Kavita Nair', 'kavita.nair@example.in', customerPass, '+91 98407 19283', 'Chennai', 'Adyar', 'CUSTOMER')
      .lastInsertRowid,
  );
  const adminId = Number(
    insertUser.run('Siddharth Rao', 'admin@localservicefinder.in', adminPass, '+91 80 4120 8899', 'Bengaluru', 'MG Road', 'ADMIN')
      .lastInsertRowid,
  );

  const insertProvider = db.prepare(
    `INSERT INTO providers (
      user_id, business_name, owner_name, primary_category_id, description,
      city, area, pincode, latitude, longitude, service_areas_json,
      verified, verification_status, response_time, response_minutes, years_experience,
      profile_image_url, cover_image_url, gallery_json, profile_views
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const insertService = db.prepare(
    `INSERT INTO provider_services (provider_id, category_id, title, description, base_price, price_unit, duration_minutes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );

  const insertAvail = db.prepare(
    `INSERT INTO availability (provider_id, day_of_week, start_time, end_time, is_available, slots_json)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );

  const providerIds: number[] = [];
  const firstServiceByProvider = new Map<number, { id: number; price: number }>();
  const providerUserIds = new Map<number, number>();

  const defaultSlots = JSON.stringify(['09:00 - 11:00', '11:30 - 13:30', '14:30 - 16:30', '17:00 - 19:00']);
  const todayDow = new Date().getDay();

  PROVIDERS.forEach((p, idx) => {
    const userId = Number(
      insertUser.run(p.ownerName, p.email, providerPass, p.phone, p.city, p.area, 'PROVIDER').lastInsertRowid,
    );
    const catId = categoryIdBySlug.get(p.categorySlug)!;
    const responseLabel = p.responseMinutes < 60 ? `Within ${p.responseMinutes} mins` : 'Within 1 hr';
    const views = 140 + ((idx * 37) % 320);

    const providerId = Number(
      insertProvider.run(
        userId,
        p.businessName,
        p.ownerName,
        catId,
        p.description,
        p.city,
        p.area,
        p.pincode,
        p.lat,
        p.lng,
        JSON.stringify(p.serviceAreas),
        p.verified ? 1 : 0,
        p.verificationStatus,
        responseLabel,
        p.responseMinutes,
        p.yearsExperience,
        p.coverImage,
        p.coverImage,
        JSON.stringify(p.gallery),
        views,
      ).lastInsertRowid,
    );

    providerIds.push(providerId);
    providerUserIds.set(providerId, userId);

    p.services.forEach((s, sIdx) => {
      const sRes = insertService.run(providerId, catId, s.title, s.description, s.basePrice, s.priceUnit, s.durationMinutes);
      if (sIdx === 0) {
        firstServiceByProvider.set(providerId, { id: Number(sRes.lastInsertRowid), price: s.basePrice });
      }
    });

    for (let dow = 0; dow <= 6; dow++) {
      let available = 1;
      if (!p.weekendOpen && (dow === 0 || dow === 6)) available = 0;
      if (!p.todayOpen && dow === todayDow) available = 0;
      insertAvail.run(providerId, dow, '09:00', '19:00', available, defaultSlots);
    }
  });

  // Seed realistic Bookings covering all 6 statuses
  const insertBooking = db.prepare(
    `INSERT INTO bookings (
      reference_code, customer_id, provider_id, service_id, scheduled_date, time_slot,
      property_type, address_area, pincode, description, quoted_price, status, cancellation_reason, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const today = new Date();
  const isoOffset = (days: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };

  const b1 = Number(
    insertBooking.run(
      'LSF-2026-1041',
      ananyaId,
      providerIds[0],
      firstServiceByProvider.get(providerIds[0])!.id,
      isoOffset(-12),
      '11:30 - 13:30',
      'Apartment',
      '100 Feet Road, Indiranagar, Bengaluru',
      '560038',
      'Kitchen sink mixer cartridge dripping continuously even when closed.',
      349,
      'COMPLETED',
      '',
      isoOffset(-14) + ' 10:15:00',
    ).lastInsertRowid,
  );

  const b2 = Number(
    insertBooking.run(
      'LSF-2026-1048',
      ananyaId,
      providerIds[6],
      firstServiceByProvider.get(providerIds[6])!.id,
      isoOffset(-5),
      '17:00 - 19:00',
      'Apartment',
      '12th Main, Indiranagar, Bengaluru',
      '560038',
      'Class 11 CBSE Calculus & Electrostatics diagnostic assessment.',
      600,
      'COMPLETED',
      '',
      isoOffset(-7) + ' 14:20:00',
    ).lastInsertRowid,
  );

  const b3 = Number(
    insertBooking.run(
      'LSF-2026-1054',
      ananyaId,
      providerIds[0],
      firstServiceByProvider.get(providerIds[0])!.id,
      isoOffset(2),
      '09:00 - 11:00',
      'Apartment',
      '100 Feet Road, Indiranagar, Bengaluru',
      '560038',
      'Annual booster pump NRV check and bathroom angle valve replacement.',
      650,
      'ACCEPTED',
      '',
      isoOffset(-1) + ' 09:40:00',
    ).lastInsertRowid,
  );

  const b4 = Number(
    insertBooking.run(
      'LSF-2026-1062',
      ananyaId,
      providerIds[17],
      firstServiceByProvider.get(providerIds[17])!.id,
      isoOffset(4),
      '11:30 - 13:30',
      'Apartment',
      '100 Feet Road, Indiranagar, Bengaluru',
      '560038',
      'Living room accent wall texture and matte finish repainting.',
      4200,
      'PENDING',
      '',
      isoOffset(0) + ' 08:10:00',
    ).lastInsertRowid,
  );

  const b5 = Number(
    insertBooking.run(
      'LSF-2026-1039',
      rohanId,
      providerIds[1],
      firstServiceByProvider.get(providerIds[1])!.id,
      isoOffset(-9),
      '14:30 - 16:30',
      'Apartment',
      'Chapel Road, Bandra West, Mumbai',
      '400050',
      'Main DB RCCB tripping whenever geyser and microwave run together.',
      449,
      'COMPLETED',
      '',
      isoOffset(-11) + ' 11:05:00',
    ).lastInsertRowid,
  );

  const b6 = Number(
    insertBooking.run(
      'LSF-2026-1059',
      rohanId,
      providerIds[8],
      firstServiceByProvider.get(providerIds[8])!.id,
      isoOffset(1),
      '14:30 - 16:30',
      'Apartment',
      'Pali Hill, Bandra West, Mumbai',
      '400050',
      'Bosch front-load washer showing E18 drain error mid-cycle.',
      399,
      'RESCHEDULED',
      '',
      isoOffset(-1) + ' 16:30:00',
    ).lastInsertRowid,
  );

  const b7 = Number(
    insertBooking.run(
      'LSF-2026-1025',
      kavitaId,
      providerIds[4],
      firstServiceByProvider.get(providerIds[4])!.id,
      isoOffset(-18),
      '09:00 - 11:00',
      'Independent House',
      'Gandhi Nagar, Adyar, Chennai',
      '600020',
      'Full 2 BHK deep cleaning before family visit.',
      3699,
      'COMPLETED',
      '',
      isoOffset(-20) + ' 13:00:00',
    ).lastInsertRowid,
  );

  const b8 = Number(
    insertBooking.run(
      'LSF-2026-1033',
      kavitaId,
      providerIds[18],
      firstServiceByProvider.get(providerIds[18])!.id,
      isoOffset(-10),
      '17:00 - 19:00',
      'Apartment',
      'Gandhi Nagar, Adyar, Chennai',
      '600020',
      'Samsung convection microwave not heating despite turntable spinning.',
      449,
      'COMPLETED',
      '',
      isoOffset(-12) + ' 18:10:00',
    ).lastInsertRowid,
  );

  const b9 = Number(
    insertBooking.run(
      'LSF-2026-1051',
      rohanId,
      providerIds[0],
      firstServiceByProvider.get(providerIds[0])!.id,
      isoOffset(3),
      '14:30 - 16:30',
      'Office',
      'Indiranagar 12th Main, Bengaluru',
      '560038',
      'Pantry tap leak inspection for studio office.',
      349,
      'PENDING',
      '',
      isoOffset(0) + ' 07:30:00',
    ).lastInsertRowid,
  );

  const b10 = Number(
    insertBooking.run(
      'LSF-2026-1021',
      ananyaId,
      providerIds[12],
      firstServiceByProvider.get(providerIds[12])!.id,
      isoOffset(-22),
      '11:30 - 13:30',
      'Apartment',
      'Indiranagar, Bengaluru',
      '560038',
      'Blocked kitchen utility drain.',
      449,
      'CANCELLED',
      'Resolved temporarily before technician dispatch.',
      isoOffset(-23) + ' 09:00:00',
    ).lastInsertRowid,
  );

  const b11 = Number(
    insertBooking.run(
      'LSF-2026-1019',
      rohanId,
      providerIds[15],
      firstServiceByProvider.get(providerIds[15])!.id,
      isoOffset(-16),
      '09:00 - 11:00',
      'Apartment',
      'Colaba, Mumbai',
      '400005',
      'Same-day sofa cleaning request.',
      899,
      'REJECTED',
      'Outside current western-suburbs service zone.',
      isoOffset(-17) + ' 12:15:00',
    ).lastInsertRowid,
  );

  // Additional completed bookings for rich multi-provider reviews
  const extraCompletedBookingIds: Array<{ bookingId: number; customerId: number; providerId: number; rating: number; comment: string; reply: string }> = [
    {
      bookingId: b1,
      customerId: ananyaId,
      providerId: providerIds[0],
      rating: 5,
      comment: 'Rajesh arrived within 20 minutes of the slot, replaced the worn Jaquar cartridge with an original spare, and tested water pressure before leaving. Neat work.',
      reply: 'Thank you Ananya. Glad the kitchen mixer is drip-free now—reach out anytime for annual checkups.',
    },
    {
      bookingId: b5,
      customerId: rohanId,
      providerId: providerIds[1],
      rating: 5,
      comment: 'Priya diagnosed the faulty neutral in our distribution board in 15 minutes and labeled every MCB circuit clearly. Very transparent pricing.',
      reply: 'Thanks Rohan. Labeling the breaker panel makes future maintenance much safer.',
    },
    {
      bookingId: b7,
      customerId: kavitaId,
      providerId: providerIds[4],
      rating: 5,
      comment: 'Four-person crew finished our entire 2 BHK in 4.5 hours. Kitchen exhaust and bathroom glass partitions look spotless without harsh chemical smell.',
      reply: 'Thank you Kavita! Happy to serve your home in Adyar.',
    },
    {
      bookingId: b8,
      customerId: kavitaId,
      providerId: providerIds[18],
      rating: 4,
      comment: 'Replaced the faulty high-voltage diode on the spot. Took slightly longer to source the screw cover, but pricing matched the initial estimate.',
      reply: '',
    },
  ];

  // Create synthetic historical completed bookings across remaining verified providers so ratings & review counts look real
  const sampleComments = [
    'Punctual arrival, clean tools, and stuck strictly to the quoted INR rate card.',
    'Explained the root fault clearly before starting work and cleaned up debris afterwards.',
    'Reliable local professional. Completed the job in one visit without unnecessary upselling.',
    'Good workmanship and courteous communication throughout the scheduled slot.',
    'Fair pricing compared to neighborhood contractors and quick follow-up confirmation.',
  ];
  const sampleCustomers = [ananyaId, rohanId, kavitaId];

  for (let i = 0; i < 22; i++) {
    const pid = providerIds[i];
    const svc = firstServiceByProvider.get(pid)!;
    const custId = sampleCustomers[i % sampleCustomers.length];
    const ref = `LSF-2026-09${(10 + i).toString()}`;
    const histBookingId = Number(
      insertBooking.run(
        ref,
        custId,
        pid,
        svc.id,
        isoOffset(-(25 + i)),
        '11:30 - 13:30',
        'Apartment',
        `${PROVIDERS[i].area}, ${PROVIDERS[i].city}`,
        PROVIDERS[i].pincode,
        `Scheduled ${PROVIDERS[i].services[0].title.toLowerCase()} service.`,
        svc.price,
        'COMPLETED',
        '',
        isoOffset(-(27 + i)) + ' 10:00:00',
      ).lastInsertRowid,
    );
    extraCompletedBookingIds.push({
      bookingId: histBookingId,
      customerId: custId,
      providerId: pid,
      rating: i % 5 === 0 ? 4 : 5,
      comment: sampleComments[i % sampleComments.length],
      reply: i % 3 === 0 ? 'Thank you for trusting our team. Always happy to help.' : '',
    });
  }

  // Note: b2 (Ananya's completed tutoring booking) intentionally has NO review yet so "Reviews to write" in Customer Dashboard is populated!
  const insertReview = db.prepare(
    `INSERT INTO reviews (booking_id, customer_id, provider_id, rating, comment, provider_reply, replied_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );

  for (const rev of extraCompletedBookingIds) {
    insertReview.run(
      rev.bookingId,
      rev.customerId,
      rev.providerId,
      rev.rating,
      rev.comment,
      rev.reply,
      rev.reply ? isoOffset(-2) + ' 16:00:00' : '',
    );
  }

  providerIds.forEach((pid) => recalculateProviderRating(db, pid));

  // Quote Requests
  const insertQuote = db.prepare(
    `INSERT INTO quote_requests (
      customer_id, provider_id, service_id, preferred_date, property_type, address_area,
      description, estimated_budget, status, quoted_amount, provider_note
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  insertQuote.run(
    ananyaId,
    providerIds[2],
    firstServiceByProvider.get(providerIds[2])!.id,
    isoOffset(5),
    'Apartment',
    'Indiranagar, Bengaluru',
    'Need deep foam cleaning for 2 split ACs and 1 gas top-up check.',
    2500,
    'QUOTED',
    2150,
    'Includes both 1.5T split AC foam-jet washes and pressure check.',
  );

  insertQuote.run(
    rohanId,
    providerIds[0],
    firstServiceByProvider.get(providerIds[0])!.id,
    isoOffset(3),
    'Independent House',
    'Bandra West, Mumbai',
    'Looking for overhead water tank float-valve replacement and piping check.',
    1200,
    'PENDING',
    null,
    '',
  );

  insertQuote.run(
    ananyaId,
    providerIds[0],
    firstServiceByProvider.get(providerIds[0])!.id,
    isoOffset(6),
    'Apartment',
    'Indiranagar, Bengaluru',
    'Need full bathroom mixer + health faucet upgrade quote.',
    2800,
    'PENDING',
    null,
    '',
  );

  // Favorites
  const insertFav = db.prepare(`INSERT INTO favorites (customer_id, provider_id) VALUES (?, ?)`);
  insertFav.run(ananyaId, providerIds[0]);
  insertFav.run(ananyaId, providerIds[6]);
  insertFav.run(ananyaId, providerIds[9]);
  insertFav.run(rohanId, providerIds[1]);
  insertFav.run(rohanId, providerIds[8]);

  // Messages
  const insertMsg = db.prepare(
    `INSERT INTO messages (booking_id, customer_id, provider_id, sender_id, body, is_read, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const kaveriUserId = providerUserIds.get(providerIds[0])!;
  insertMsg.run(
    b3,
    ananyaId,
    providerIds[0],
    ananyaId,
    'Hi Rajesh, our apartment gate requires visitor entry via MyGate—should I pre-approve for 9:15 AM?',
    1,
    isoOffset(-1) + ' 18:10:00',
  );
  insertMsg.run(
    b3,
    ananyaId,
    providerIds[0],
    kaveriUserId,
    'Yes please, Ananya. Technician Suresh will arrive at 9:15 AM with a replacement 1-inch brass NRV.',
    0,
    isoOffset(-1) + ' 18:24:00',
  );

  // Notifications
  const insertNotif = db.prepare(
    `INSERT INTO notifications (user_id, title, body, link_url, is_read) VALUES (?, ?, ?, ?, ?)`,
  );
  insertNotif.run(
    ananyaId,
    'Booking Accepted — Kaveri Precision Plumbing',
    'Your booking LSF-2026-1054 has been confirmed for ' + isoOffset(2) + ' (09:00 - 11:00).',
    '/customer-dashboard.html?tab=bookings',
    0,
  );
  insertNotif.run(
    ananyaId,
    'Quote Received — ₹2,150',
    'Deccan CoolAir HVAC sent a revised estimate for your 2-AC servicing request.',
    '/customer-dashboard.html?tab=quotes',
    0,
  );
  insertNotif.run(
    kaveriUserId,
    'New Booking Request — LSF-2026-1051',
    'Rohan Mehta requested a Pantry tap leak inspection.',
    '/provider-dashboard.html?tab=bookings',
    0,
  );
  insertNotif.run(
    adminId,
    '4 Providers Awaiting Verification',
    'Review pending trade licenses and service profiles in the verification queue.',
    '/admin-dashboard.html?tab=verifications',
    0,
  );
}
