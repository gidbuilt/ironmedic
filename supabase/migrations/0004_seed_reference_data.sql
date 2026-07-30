-- IronMedic — seed the verified J1939 reference tables (knowledge layer 2).
--
-- Sourced and cross-checked against SAE J1939-71 (parameter definitions) and
-- SAE J1939-73 Appendix A (failure mode identifiers) via multiple independent
-- public references during this build. This is real, verifiable public
-- standard data — not model-guessed. Still, treat this as a starting set:
-- before relying on it in production, cross-check against the official SAE
-- J1939 documents or a paid J1939 database, since this was compiled from
-- public secondary sources rather than the paywalled SAE spec itself.
--
-- `spn_codes` rows below all have make = NULL (universal, SAE-standard).
-- The OEM-proprietary slot (make = 'Caterpillar' / 'John Deere' / etc.,
-- SPNs in the 520192-524287 range) is intentionally left empty — populate
-- only from a verified manufacturer source, never fabricate.

-- Belt-and-suspenders: 0003_fix_spn_codes_pk.sql already drops this NOT NULL
-- on fresh installs, but this statement is idempotent and cheap, so it's
-- repeated here in case this migration ever runs against a database where
-- 0003 was applied before that line existed.
alter table spn_codes alter column make drop not null;

insert into spn_codes (spn, make, name, system, description) values
  (84,   null, 'Wheel-Based Vehicle Speed',              'Powertrain',   'Vehicle/travel speed as measured at the wheel or track drive.'),
  (91,   null, 'Accelerator Pedal Position 1',           'Engine Control','Operator throttle/pedal demand signal.'),
  (92,   null, 'Engine Percent Load At Current Speed',   'Engine Control','Engine load as a percentage of available torque at the current speed.'),
  (94,   null, 'Fuel Delivery Pressure',                 'Fuel System',  'Low-pressure fuel supply pressure feeding the injection system.'),
  (98,   null, 'Engine Oil Level',                       'Lubrication',  'Sump oil level, typically from a level switch or sensor.'),
  (100,  null, 'Engine Oil Pressure',                    'Lubrication',  'Main gallery oil pressure — a primary engine health indicator.'),
  (101,  null, 'Engine Crankcase Pressure',               'Lubrication',  'Blow-by pressure inside the crankcase; high readings suggest ring/seal wear.'),
  (102,  null, 'Engine Turbocharger Boost Pressure',      'Air Intake',   'Intake manifold boost pressure downstream of the turbocharger.'),
  (105,  null, 'Engine Intake Manifold 1 Temperature',    'Air Intake',   'Charge air temperature after the charge air cooler.'),
  (108,  null, 'Barometric Pressure',                     'Air Intake',  'Ambient atmospheric pressure, used to correct other pressure readings for altitude.'),
  (109,  null, 'Engine Coolant Pressure',                 'Cooling',      'Coolant system pressure; low readings can indicate a leak or failing water pump.'),
  (110,  null, 'Engine Coolant Temperature',              'Cooling',      'Primary overheating/thermostat indicator.'),
  (111,  null, 'Engine Coolant Level',                    'Cooling',      'Coolant reservoir/system level.'),
  (127,  null, 'Transmission Oil Pressure',               'Powertrain',   'Hydraulic pressure within the transmission, often tied to clutch/converter health.'),
  (168,  null, 'Battery Potential / Power Input #1',      'Electrical',   'System supply voltage, e.g. charging system and battery health.'),
  (172,  null, 'Engine Air Inlet Temperature',            'Air Intake',   'Ambient air temperature entering the intake system, before the turbo/charge cooler.'),
  (173,  null, 'Engine Exhaust Gas Temperature',          'Exhaust',      'Exhaust temperature, relevant to combustion and aftertreatment health.'),
  (174,  null, 'Engine Fuel Temperature 1',                'Fuel System',  'Fuel temperature at the point of measurement in the supply system.'),
  (175,  null, 'Engine Oil Temperature 1',                 'Lubrication',  'Engine oil temperature, relevant to viscosity and cooling system load.'),
  (176,  null, 'Engine Turbocharger Oil Temperature',     'Air Intake',   'Oil temperature specifically at the turbocharger bearing housing.'),
  (177,  null, 'Transmission Oil Temperature',            'Powertrain',   'Transmission fluid temperature; overheating often points to a cooling or load issue.'),
  (190,  null, 'Engine Speed',                             'Engine Control','Crankshaft RPM.'),
  (247,  null, 'Engine Total Hours of Operation',         'Engine Control','Lifetime engine hour meter — cross-reference against the machine''s own recorded hours.'),
  (250,  null, 'Engine Total Fuel Used',                  'Fuel System',  'Lifetime fuel consumption counter.'),
  (1127, null, 'Engine Turbocharger 1 Boost Pressure',     'Air Intake',  'Boost pressure specific to turbocharger #1 on multi-turbo engines.')
on conflict (spn) where make is null do nothing;

insert into fmi_codes (fmi, description, severity_hint) values
  (0,  'Data valid but above normal operational range — most severe level', 'most_severe'),
  (1,  'Data valid but below normal operational range — most severe level', 'most_severe'),
  (2,  'Data erratic, intermittent, or incorrect', null),
  (3,  'Voltage above normal, or shorted to high source', null),
  (4,  'Voltage below normal, or shorted to low source', null),
  (5,  'Current below normal, or open circuit', null),
  (6,  'Current above normal, or grounded circuit', null),
  (7,  'Mechanical system not responding, or out of adjustment', null),
  (8,  'Abnormal frequency, pulse width, or period', null),
  (9,  'Abnormal update rate', null),
  (10, 'Abnormal rate of change', null),
  (11, 'Root cause not known', null),
  (12, 'Bad intelligent device or component', null),
  (13, 'Out of calibration', null),
  (14, 'Special instructions', null),
  (15, 'Data valid but above normal operational range — least severe level', 'least_severe'),
  (16, 'Data valid but above normal operational range — moderately severe level', 'moderately_severe'),
  (17, 'Data valid but below normal operational range — least severe level', 'least_severe'),
  (18, 'Data valid but below normal operational range — moderately severe level', 'moderately_severe'),
  (19, 'Received network data in error', null),
  (20, 'Data drifted high', null),
  (21, 'Data drifted low', null),
  (22, 'Reserved for future assignment by SAE', null),
  (23, 'Reserved for future assignment by SAE', null),
  (24, 'Reserved for future assignment by SAE', null),
  (25, 'Reserved for future assignment by SAE', null),
  (26, 'Reserved for future assignment by SAE', null),
  (27, 'Reserved for future assignment by SAE', null),
  (28, 'Reserved for future assignment by SAE', null),
  (29, 'Reserved for future assignment by SAE', null),
  (30, 'Reserved for future assignment by SAE', null),
  (31, 'Condition exists', null)
on conflict (fmi) do nothing;
