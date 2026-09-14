-- Northline reviewed U.S. editorial source registry (100 records).
-- Safe to run repeatedly: records are upserted by the unique domain.
-- Registry membership enables attribution and evidence selection only. It does
-- not authorize copying articles, photographs, video, graphics, transcripts,
-- or third-party assets. Every record defaults to link_only.

INSERT INTO sources (
  id, name, domain, publisher, source_type, country, ownership,
  credibility_tier, is_primary, citation_requirements, licensing_status,
  reliability_notes, last_reviewed_at, created_at, updated_at
) VALUES
  (
    'source_whitehouse_gov', 'The White House', 'whitehouse.gov', 'The White House', 'GOVERNMENT', 'US', 'Executive Office of the President',
    1, 1, 'Link to the exact official record, release, data page, schedule, filing, order, advisory, or statement on whitehouse.gov; preserve the publication or update time and identify the issuing office. Official claims require independent context for disputed or high-risk coverage.', 'link_only',
    'Primary-source registry entry for The White House. Use it for attributable facts within its authority; do not treat an official statement as independent confirmation, and verify revisions or preliminary values.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_congress_gov', 'Congress.gov', 'congress.gov', 'Congress.gov', 'PRIMARY_DOCUMENT', 'US', 'Library of Congress',
    1, 1, 'Link to the exact official record, release, data page, schedule, filing, order, advisory, or statement on congress.gov; preserve the publication or update time and identify the issuing office. Official claims require independent context for disputed or high-risk coverage.', 'link_only',
    'Primary-source registry entry for Congress.gov. Use it for attributable facts within its authority; do not treat an official statement as independent confirmation, and verify revisions or preliminary values.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_federalregister_gov', 'Federal Register', 'federalregister.gov', 'Federal Register', 'PRIMARY_DOCUMENT', 'US', 'Office of the Federal Register',
    1, 1, 'Link to the exact official record, release, data page, schedule, filing, order, advisory, or statement on federalregister.gov; preserve the publication or update time and identify the issuing office. Official claims require independent context for disputed or high-risk coverage.', 'link_only',
    'Primary-source registry entry for Federal Register. Use it for attributable facts within its authority; do not treat an official statement as independent confirmation, and verify revisions or preliminary values.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_govinfo_gov', 'GovInfo', 'govinfo.gov', 'GovInfo', 'PRIMARY_DOCUMENT', 'US', 'U.S. Government Publishing Office',
    1, 1, 'Link to the exact official record, release, data page, schedule, filing, order, advisory, or statement on govinfo.gov; preserve the publication or update time and identify the issuing office. Official claims require independent context for disputed or high-risk coverage.', 'link_only',
    'Primary-source registry entry for GovInfo. Use it for attributable facts within its authority; do not treat an official statement as independent confirmation, and verify revisions or preliminary values.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_supremecourt_gov', 'Supreme Court of the United States', 'supremecourt.gov', 'Supreme Court of the United States', 'COURT', 'US', 'Supreme Court of the United States',
    1, 1, 'Link to the exact official record, release, data page, schedule, filing, order, advisory, or statement on supremecourt.gov; preserve the publication or update time and identify the issuing office. Official claims require independent context for disputed or high-risk coverage.', 'link_only',
    'Primary-source registry entry for Supreme Court of the United States. Use it for attributable facts within its authority; do not treat an official statement as independent confirmation, and verify revisions or preliminary values.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_uscourts_gov', 'United States Courts', 'uscourts.gov', 'Administrative Office of the U.S. Courts', 'COURT', 'US', 'Federal Judiciary',
    1, 1, 'Link to the exact official record, release, data page, schedule, filing, order, advisory, or statement on uscourts.gov; preserve the publication or update time and identify the issuing office. Official claims require independent context for disputed or high-risk coverage.', 'link_only',
    'Primary-source registry entry for United States Courts. Use it for attributable facts within its authority; do not treat an official statement as independent confirmation, and verify revisions or preliminary values.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_justice_gov', 'U.S. Department of Justice', 'justice.gov', 'U.S. Department of Justice', 'GOVERNMENT', 'US', 'United States Government',
    1, 1, 'Link to the exact official record, release, data page, schedule, filing, order, advisory, or statement on justice.gov; preserve the publication or update time and identify the issuing office. Official claims require independent context for disputed or high-risk coverage.', 'link_only',
    'Primary-source registry entry for U.S. Department of Justice. Use it for attributable facts within its authority; do not treat an official statement as independent confirmation, and verify revisions or preliminary values.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_fbi_gov', 'Federal Bureau of Investigation', 'fbi.gov', 'FBI', 'LAW_ENFORCEMENT', 'US', 'U.S. Department of Justice',
    1, 1, 'Link to the exact official record, release, data page, schedule, filing, order, advisory, or statement on fbi.gov; preserve the publication or update time and identify the issuing office. Official claims require independent context for disputed or high-risk coverage.', 'link_only',
    'Primary-source registry entry for Federal Bureau of Investigation. Use it for attributable facts within its authority; do not treat an official statement as independent confirmation, and verify revisions or preliminary values.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_dhs_gov', 'Department of Homeland Security', 'dhs.gov', 'DHS', 'GOVERNMENT', 'US', 'United States Government',
    1, 1, 'Link to the exact official record, release, data page, schedule, filing, order, advisory, or statement on dhs.gov; preserve the publication or update time and identify the issuing office. Official claims require independent context for disputed or high-risk coverage.', 'link_only',
    'Primary-source registry entry for Department of Homeland Security. Use it for attributable facts within its authority; do not treat an official statement as independent confirmation, and verify revisions or preliminary values.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_cisa_gov', 'Cybersecurity and Infrastructure Security Agency', 'cisa.gov', 'CISA', 'CYBERSECURITY', 'US', 'U.S. Department of Homeland Security',
    1, 1, 'Link to the exact official record, release, data page, schedule, filing, order, advisory, or statement on cisa.gov; preserve the publication or update time and identify the issuing office. Official claims require independent context for disputed or high-risk coverage.', 'link_only',
    'Primary-source registry entry for Cybersecurity and Infrastructure Security Agency. Use it for attributable facts within its authority; do not treat an official statement as independent confirmation, and verify revisions or preliminary values.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_fema_gov', 'Federal Emergency Management Agency', 'fema.gov', 'FEMA', 'EMERGENCY', 'US', 'U.S. Department of Homeland Security',
    1, 1, 'Link to the exact official record, release, data page, schedule, filing, order, advisory, or statement on fema.gov; preserve the publication or update time and identify the issuing office. Official claims require independent context for disputed or high-risk coverage.', 'link_only',
    'Primary-source registry entry for Federal Emergency Management Agency. Use it for attributable facts within its authority; do not treat an official statement as independent confirmation, and verify revisions or preliminary values.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_weather_gov', 'National Weather Service', 'weather.gov', 'National Weather Service', 'WEATHER', 'US', 'NOAA',
    1, 1, 'Link to the exact official record, release, data page, schedule, filing, order, advisory, or statement on weather.gov; preserve the publication or update time and identify the issuing office. Official claims require independent context for disputed or high-risk coverage.', 'link_only',
    'Primary-source registry entry for National Weather Service. Use it for attributable facts within its authority; do not treat an official statement as independent confirmation, and verify revisions or preliminary values.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_noaa_gov', 'NOAA', 'noaa.gov', 'NOAA', 'SCIENCE_AGENCY', 'US', 'U.S. Department of Commerce',
    1, 1, 'Link to the exact official record, release, data page, schedule, filing, order, advisory, or statement on noaa.gov; preserve the publication or update time and identify the issuing office. Official claims require independent context for disputed or high-risk coverage.', 'link_only',
    'Primary-source registry entry for NOAA. Use it for attributable facts within its authority; do not treat an official statement as independent confirmation, and verify revisions or preliminary values.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_nhc_noaa_gov', 'National Hurricane Center', 'nhc.noaa.gov', 'National Hurricane Center', 'WEATHER', 'US', 'NOAA',
    1, 1, 'Link to the exact official record, release, data page, schedule, filing, order, advisory, or statement on nhc.noaa.gov; preserve the publication or update time and identify the issuing office. Official claims require independent context for disputed or high-risk coverage.', 'link_only',
    'Primary-source registry entry for National Hurricane Center. Use it for attributable facts within its authority; do not treat an official statement as independent confirmation, and verify revisions or preliminary values.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_spc_noaa_gov', 'Storm Prediction Center', 'spc.noaa.gov', 'Storm Prediction Center', 'WEATHER', 'US', 'NOAA',
    1, 1, 'Link to the exact official record, release, data page, schedule, filing, order, advisory, or statement on spc.noaa.gov; preserve the publication or update time and identify the issuing office. Official claims require independent context for disputed or high-risk coverage.', 'link_only',
    'Primary-source registry entry for Storm Prediction Center. Use it for attributable facts within its authority; do not treat an official statement as independent confirmation, and verify revisions or preliminary values.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_usgs_gov', 'U.S. Geological Survey', 'usgs.gov', 'USGS', 'SCIENCE_AGENCY', 'US', 'U.S. Department of the Interior',
    1, 1, 'Link to the exact official record, release, data page, schedule, filing, order, advisory, or statement on usgs.gov; preserve the publication or update time and identify the issuing office. Official claims require independent context for disputed or high-risk coverage.', 'link_only',
    'Primary-source registry entry for U.S. Geological Survey. Use it for attributable facts within its authority; do not treat an official statement as independent confirmation, and verify revisions or preliminary values.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_epa_gov', 'Environmental Protection Agency', 'epa.gov', 'EPA', 'GOVERNMENT', 'US', 'United States Government',
    1, 1, 'Link to the exact official record, release, data page, schedule, filing, order, advisory, or statement on epa.gov; preserve the publication or update time and identify the issuing office. Official claims require independent context for disputed or high-risk coverage.', 'link_only',
    'Primary-source registry entry for Environmental Protection Agency. Use it for attributable facts within its authority; do not treat an official statement as independent confirmation, and verify revisions or preliminary values.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_nasa_gov', 'NASA', 'nasa.gov', 'NASA', 'SCIENCE_AGENCY', 'US', 'United States Government',
    1, 1, 'Link to the exact official record, release, data page, schedule, filing, order, advisory, or statement on nasa.gov; preserve the publication or update time and identify the issuing office. Official claims require independent context for disputed or high-risk coverage.', 'link_only',
    'Primary-source registry entry for NASA. Use it for attributable facts within its authority; do not treat an official statement as independent confirmation, and verify revisions or preliminary values.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_cdc_gov', 'Centers for Disease Control and Prevention', 'cdc.gov', 'CDC', 'HEALTH_AGENCY', 'US', 'U.S. Department of Health and Human Services',
    1, 1, 'Link to the exact official record, release, data page, schedule, filing, order, advisory, or statement on cdc.gov; preserve the publication or update time and identify the issuing office. Official claims require independent context for disputed or high-risk coverage.', 'link_only',
    'Primary-source registry entry for Centers for Disease Control and Prevention. Use it for attributable facts within its authority; do not treat an official statement as independent confirmation, and verify revisions or preliminary values.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_fda_gov', 'U.S. Food and Drug Administration', 'fda.gov', 'FDA', 'HEALTH_AGENCY', 'US', 'U.S. Department of Health and Human Services',
    1, 1, 'Link to the exact official record, release, data page, schedule, filing, order, advisory, or statement on fda.gov; preserve the publication or update time and identify the issuing office. Official claims require independent context for disputed or high-risk coverage.', 'link_only',
    'Primary-source registry entry for U.S. Food and Drug Administration. Use it for attributable facts within its authority; do not treat an official statement as independent confirmation, and verify revisions or preliminary values.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_nih_gov', 'National Institutes of Health', 'nih.gov', 'NIH', 'HEALTH_AGENCY', 'US', 'U.S. Department of Health and Human Services',
    1, 1, 'Link to the exact official record, release, data page, schedule, filing, order, advisory, or statement on nih.gov; preserve the publication or update time and identify the issuing office. Official claims require independent context for disputed or high-risk coverage.', 'link_only',
    'Primary-source registry entry for National Institutes of Health. Use it for attributable facts within its authority; do not treat an official statement as independent confirmation, and verify revisions or preliminary values.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_hhs_gov', 'U.S. Department of Health and Human Services', 'hhs.gov', 'HHS', 'HEALTH_AGENCY', 'US', 'United States Government',
    1, 1, 'Link to the exact official record, release, data page, schedule, filing, order, advisory, or statement on hhs.gov; preserve the publication or update time and identify the issuing office. Official claims require independent context for disputed or high-risk coverage.', 'link_only',
    'Primary-source registry entry for U.S. Department of Health and Human Services. Use it for attributable facts within its authority; do not treat an official statement as independent confirmation, and verify revisions or preliminary values.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_cms_gov', 'Centers for Medicare & Medicaid Services', 'cms.gov', 'CMS', 'HEALTH_AGENCY', 'US', 'U.S. Department of Health and Human Services',
    1, 1, 'Link to the exact official record, release, data page, schedule, filing, order, advisory, or statement on cms.gov; preserve the publication or update time and identify the issuing office. Official claims require independent context for disputed or high-risk coverage.', 'link_only',
    'Primary-source registry entry for Centers for Medicare & Medicaid Services. Use it for attributable facts within its authority; do not treat an official statement as independent confirmation, and verify revisions or preliminary values.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_sec_gov', 'U.S. Securities and Exchange Commission', 'sec.gov', 'SEC', 'REGULATOR', 'US', 'United States Government',
    1, 1, 'Link to the exact official record, release, data page, schedule, filing, order, advisory, or statement on sec.gov; preserve the publication or update time and identify the issuing office. Official claims require independent context for disputed or high-risk coverage.', 'link_only',
    'Primary-source registry entry for U.S. Securities and Exchange Commission. Use it for attributable facts within its authority; do not treat an official statement as independent confirmation, and verify revisions or preliminary values.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_federalreserve_gov', 'Federal Reserve Board', 'federalreserve.gov', 'Federal Reserve Board', 'CENTRAL_BANK', 'US', 'Board of Governors of the Federal Reserve System',
    1, 1, 'Link to the exact official record, release, data page, schedule, filing, order, advisory, or statement on federalreserve.gov; preserve the publication or update time and identify the issuing office. Official claims require independent context for disputed or high-risk coverage.', 'link_only',
    'Primary-source registry entry for Federal Reserve Board. Use it for attributable facts within its authority; do not treat an official statement as independent confirmation, and verify revisions or preliminary values.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_bls_gov', 'U.S. Bureau of Labor Statistics', 'bls.gov', 'BLS', 'DATASET', 'US', 'U.S. Department of Labor',
    1, 1, 'Link to the exact official record, release, data page, schedule, filing, order, advisory, or statement on bls.gov; preserve the publication or update time and identify the issuing office. Official claims require independent context for disputed or high-risk coverage.', 'link_only',
    'Primary-source registry entry for U.S. Bureau of Labor Statistics. Use it for attributable facts within its authority; do not treat an official statement as independent confirmation, and verify revisions or preliminary values.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_bea_gov', 'U.S. Bureau of Economic Analysis', 'bea.gov', 'BEA', 'DATASET', 'US', 'U.S. Department of Commerce',
    1, 1, 'Link to the exact official record, release, data page, schedule, filing, order, advisory, or statement on bea.gov; preserve the publication or update time and identify the issuing office. Official claims require independent context for disputed or high-risk coverage.', 'link_only',
    'Primary-source registry entry for U.S. Bureau of Economic Analysis. Use it for attributable facts within its authority; do not treat an official statement as independent confirmation, and verify revisions or preliminary values.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_census_gov', 'U.S. Census Bureau', 'census.gov', 'U.S. Census Bureau', 'DATASET', 'US', 'U.S. Department of Commerce',
    1, 1, 'Link to the exact official record, release, data page, schedule, filing, order, advisory, or statement on census.gov; preserve the publication or update time and identify the issuing office. Official claims require independent context for disputed or high-risk coverage.', 'link_only',
    'Primary-source registry entry for U.S. Census Bureau. Use it for attributable facts within its authority; do not treat an official statement as independent confirmation, and verify revisions or preliminary values.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_treasury_gov', 'U.S. Department of the Treasury', 'treasury.gov', 'U.S. Treasury', 'GOVERNMENT', 'US', 'United States Government',
    1, 1, 'Link to the exact official record, release, data page, schedule, filing, order, advisory, or statement on treasury.gov; preserve the publication or update time and identify the issuing office. Official claims require independent context for disputed or high-risk coverage.', 'link_only',
    'Primary-source registry entry for U.S. Department of the Treasury. Use it for attributable facts within its authority; do not treat an official statement as independent confirmation, and verify revisions or preliminary values.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_irs_gov', 'Internal Revenue Service', 'irs.gov', 'IRS', 'GOVERNMENT', 'US', 'U.S. Department of the Treasury',
    1, 1, 'Link to the exact official record, release, data page, schedule, filing, order, advisory, or statement on irs.gov; preserve the publication or update time and identify the issuing office. Official claims require independent context for disputed or high-risk coverage.', 'link_only',
    'Primary-source registry entry for Internal Revenue Service. Use it for attributable facts within its authority; do not treat an official statement as independent confirmation, and verify revisions or preliminary values.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_ftc_gov', 'Federal Trade Commission', 'ftc.gov', 'FTC', 'REGULATOR', 'US', 'United States Government',
    1, 1, 'Link to the exact official record, release, data page, schedule, filing, order, advisory, or statement on ftc.gov; preserve the publication or update time and identify the issuing office. Official claims require independent context for disputed or high-risk coverage.', 'link_only',
    'Primary-source registry entry for Federal Trade Commission. Use it for attributable facts within its authority; do not treat an official statement as independent confirmation, and verify revisions or preliminary values.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_consumerfinance_gov', 'Consumer Financial Protection Bureau', 'consumerfinance.gov', 'CFPB', 'REGULATOR', 'US', 'United States Government',
    1, 1, 'Link to the exact official record, release, data page, schedule, filing, order, advisory, or statement on consumerfinance.gov; preserve the publication or update time and identify the issuing office. Official claims require independent context for disputed or high-risk coverage.', 'link_only',
    'Primary-source registry entry for Consumer Financial Protection Bureau. Use it for attributable facts within its authority; do not treat an official statement as independent confirmation, and verify revisions or preliminary values.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_dol_gov', 'U.S. Department of Labor', 'dol.gov', 'U.S. Department of Labor', 'GOVERNMENT', 'US', 'United States Government',
    1, 1, 'Link to the exact official record, release, data page, schedule, filing, order, advisory, or statement on dol.gov; preserve the publication or update time and identify the issuing office. Official claims require independent context for disputed or high-risk coverage.', 'link_only',
    'Primary-source registry entry for U.S. Department of Labor. Use it for attributable facts within its authority; do not treat an official statement as independent confirmation, and verify revisions or preliminary values.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_commerce_gov', 'U.S. Department of Commerce', 'commerce.gov', 'U.S. Department of Commerce', 'GOVERNMENT', 'US', 'United States Government',
    1, 1, 'Link to the exact official record, release, data page, schedule, filing, order, advisory, or statement on commerce.gov; preserve the publication or update time and identify the issuing office. Official claims require independent context for disputed or high-risk coverage.', 'link_only',
    'Primary-source registry entry for U.S. Department of Commerce. Use it for attributable facts within its authority; do not treat an official statement as independent confirmation, and verify revisions or preliminary values.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_energy_gov', 'U.S. Department of Energy', 'energy.gov', 'U.S. Department of Energy', 'GOVERNMENT', 'US', 'United States Government',
    1, 1, 'Link to the exact official record, release, data page, schedule, filing, order, advisory, or statement on energy.gov; preserve the publication or update time and identify the issuing office. Official claims require independent context for disputed or high-risk coverage.', 'link_only',
    'Primary-source registry entry for U.S. Department of Energy. Use it for attributable facts within its authority; do not treat an official statement as independent confirmation, and verify revisions or preliminary values.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_eia_gov', 'U.S. Energy Information Administration', 'eia.gov', 'EIA', 'DATASET', 'US', 'U.S. Department of Energy',
    1, 1, 'Link to the exact official record, release, data page, schedule, filing, order, advisory, or statement on eia.gov; preserve the publication or update time and identify the issuing office. Official claims require independent context for disputed or high-risk coverage.', 'link_only',
    'Primary-source registry entry for U.S. Energy Information Administration. Use it for attributable facts within its authority; do not treat an official statement as independent confirmation, and verify revisions or preliminary values.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_faa_gov', 'Federal Aviation Administration', 'faa.gov', 'FAA', 'TRANSPORT_REGULATOR', 'US', 'U.S. Department of Transportation',
    1, 1, 'Link to the exact official record, release, data page, schedule, filing, order, advisory, or statement on faa.gov; preserve the publication or update time and identify the issuing office. Official claims require independent context for disputed or high-risk coverage.', 'link_only',
    'Primary-source registry entry for Federal Aviation Administration. Use it for attributable facts within its authority; do not treat an official statement as independent confirmation, and verify revisions or preliminary values.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_nhtsa_gov', 'National Highway Traffic Safety Administration', 'nhtsa.gov', 'NHTSA', 'TRANSPORT_REGULATOR', 'US', 'U.S. Department of Transportation',
    1, 1, 'Link to the exact official record, release, data page, schedule, filing, order, advisory, or statement on nhtsa.gov; preserve the publication or update time and identify the issuing office. Official claims require independent context for disputed or high-risk coverage.', 'link_only',
    'Primary-source registry entry for National Highway Traffic Safety Administration. Use it for attributable facts within its authority; do not treat an official statement as independent confirmation, and verify revisions or preliminary values.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_transportation_gov', 'U.S. Department of Transportation', 'transportation.gov', 'U.S. Department of Transportation', 'GOVERNMENT', 'US', 'United States Government',
    1, 1, 'Link to the exact official record, release, data page, schedule, filing, order, advisory, or statement on transportation.gov; preserve the publication or update time and identify the issuing office. Official claims require independent context for disputed or high-risk coverage.', 'link_only',
    'Primary-source registry entry for U.S. Department of Transportation. Use it for attributable facts within its authority; do not treat an official statement as independent confirmation, and verify revisions or preliminary values.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_tsa_gov', 'Transportation Security Administration', 'tsa.gov', 'TSA', 'TRANSPORT_AGENCY', 'US', 'U.S. Department of Homeland Security',
    1, 1, 'Link to the exact official record, release, data page, schedule, filing, order, advisory, or statement on tsa.gov; preserve the publication or update time and identify the issuing office. Official claims require independent context for disputed or high-risk coverage.', 'link_only',
    'Primary-source registry entry for Transportation Security Administration. Use it for attributable facts within its authority; do not treat an official statement as independent confirmation, and verify revisions or preliminary values.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_ntsb_gov', 'National Transportation Safety Board', 'ntsb.gov', 'NTSB', 'INVESTIGATIVE_AGENCY', 'US', 'United States Government',
    1, 1, 'Link to the exact official record, release, data page, schedule, filing, order, advisory, or statement on ntsb.gov; preserve the publication or update time and identify the issuing office. Official claims require independent context for disputed or high-risk coverage.', 'link_only',
    'Primary-source registry entry for National Transportation Safety Board. Use it for attributable facts within its authority; do not treat an official statement as independent confirmation, and verify revisions or preliminary values.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_usda_gov', 'U.S. Department of Agriculture', 'usda.gov', 'USDA', 'GOVERNMENT', 'US', 'United States Government',
    1, 1, 'Link to the exact official record, release, data page, schedule, filing, order, advisory, or statement on usda.gov; preserve the publication or update time and identify the issuing office. Official claims require independent context for disputed or high-risk coverage.', 'link_only',
    'Primary-source registry entry for U.S. Department of Agriculture. Use it for attributable facts within its authority; do not treat an official statement as independent confirmation, and verify revisions or preliminary values.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_fsis_usda_gov', 'Food Safety and Inspection Service', 'fsis.usda.gov', 'FSIS', 'HEALTH_AGENCY', 'US', 'U.S. Department of Agriculture',
    1, 1, 'Link to the exact official record, release, data page, schedule, filing, order, advisory, or statement on fsis.usda.gov; preserve the publication or update time and identify the issuing office. Official claims require independent context for disputed or high-risk coverage.', 'link_only',
    'Primary-source registry entry for Food Safety and Inspection Service. Use it for attributable facts within its authority; do not treat an official statement as independent confirmation, and verify revisions or preliminary values.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_ed_gov', 'U.S. Department of Education', 'ed.gov', 'U.S. Department of Education', 'GOVERNMENT', 'US', 'United States Government',
    1, 1, 'Link to the exact official record, release, data page, schedule, filing, order, advisory, or statement on ed.gov; preserve the publication or update time and identify the issuing office. Official claims require independent context for disputed or high-risk coverage.', 'link_only',
    'Primary-source registry entry for U.S. Department of Education. Use it for attributable facts within its authority; do not treat an official statement as independent confirmation, and verify revisions or preliminary values.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_state_gov', 'U.S. Department of State', 'state.gov', 'U.S. Department of State', 'GOVERNMENT', 'US', 'United States Government',
    1, 1, 'Link to the exact official record, release, data page, schedule, filing, order, advisory, or statement on state.gov; preserve the publication or update time and identify the issuing office. Official claims require independent context for disputed or high-risk coverage.', 'link_only',
    'Primary-source registry entry for U.S. Department of State. Use it for attributable facts within its authority; do not treat an official statement as independent confirmation, and verify revisions or preliminary values.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_defense_gov', 'U.S. Department of Defense', 'defense.gov', 'U.S. Department of Defense', 'GOVERNMENT', 'US', 'United States Government',
    1, 1, 'Link to the exact official record, release, data page, schedule, filing, order, advisory, or statement on defense.gov; preserve the publication or update time and identify the issuing office. Official claims require independent context for disputed or high-risk coverage.', 'link_only',
    'Primary-source registry entry for U.S. Department of Defense. Use it for attributable facts within its authority; do not treat an official statement as independent confirmation, and verify revisions or preliminary values.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_cbp_gov', 'U.S. Customs and Border Protection', 'cbp.gov', 'CBP', 'LAW_ENFORCEMENT', 'US', 'U.S. Department of Homeland Security',
    1, 1, 'Link to the exact official record, release, data page, schedule, filing, order, advisory, or statement on cbp.gov; preserve the publication or update time and identify the issuing office. Official claims require independent context for disputed or high-risk coverage.', 'link_only',
    'Primary-source registry entry for U.S. Customs and Border Protection. Use it for attributable facts within its authority; do not treat an official statement as independent confirmation, and verify revisions or preliminary values.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_ice_gov', 'U.S. Immigration and Customs Enforcement', 'ice.gov', 'ICE', 'LAW_ENFORCEMENT', 'US', 'U.S. Department of Homeland Security',
    1, 1, 'Link to the exact official record, release, data page, schedule, filing, order, advisory, or statement on ice.gov; preserve the publication or update time and identify the issuing office. Official claims require independent context for disputed or high-risk coverage.', 'link_only',
    'Primary-source registry entry for U.S. Immigration and Customs Enforcement. Use it for attributable facts within its authority; do not treat an official statement as independent confirmation, and verify revisions or preliminary values.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_uscis_gov', 'U.S. Citizenship and Immigration Services', 'uscis.gov', 'USCIS', 'GOVERNMENT', 'US', 'U.S. Department of Homeland Security',
    1, 1, 'Link to the exact official record, release, data page, schedule, filing, order, advisory, or statement on uscis.gov; preserve the publication or update time and identify the issuing office. Official claims require independent context for disputed or high-risk coverage.', 'link_only',
    'Primary-source registry entry for U.S. Citizenship and Immigration Services. Use it for attributable facts within its authority; do not treat an official statement as independent confirmation, and verify revisions or preliminary values.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_ssa_gov', 'Social Security Administration', 'ssa.gov', 'SSA', 'GOVERNMENT', 'US', 'United States Government',
    1, 1, 'Link to the exact official record, release, data page, schedule, filing, order, advisory, or statement on ssa.gov; preserve the publication or update time and identify the issuing office. Official claims require independent context for disputed or high-risk coverage.', 'link_only',
    'Primary-source registry entry for Social Security Administration. Use it for attributable facts within its authority; do not treat an official statement as independent confirmation, and verify revisions or preliminary values.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_va_gov', 'U.S. Department of Veterans Affairs', 'va.gov', 'VA', 'GOVERNMENT', 'US', 'United States Government',
    1, 1, 'Link to the exact official record, release, data page, schedule, filing, order, advisory, or statement on va.gov; preserve the publication or update time and identify the issuing office. Official claims require independent context for disputed or high-risk coverage.', 'link_only',
    'Primary-source registry entry for U.S. Department of Veterans Affairs. Use it for attributable facts within its authority; do not treat an official statement as independent confirmation, and verify revisions or preliminary values.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_hud_gov', 'U.S. Department of Housing and Urban Development', 'hud.gov', 'HUD', 'GOVERNMENT', 'US', 'United States Government',
    1, 1, 'Link to the exact official record, release, data page, schedule, filing, order, advisory, or statement on hud.gov; preserve the publication or update time and identify the issuing office. Official claims require independent context for disputed or high-risk coverage.', 'link_only',
    'Primary-source registry entry for U.S. Department of Housing and Urban Development. Use it for attributable facts within its authority; do not treat an official statement as independent confirmation, and verify revisions or preliminary values.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_doi_gov', 'U.S. Department of the Interior', 'doi.gov', 'U.S. Department of the Interior', 'GOVERNMENT', 'US', 'United States Government',
    1, 1, 'Link to the exact official record, release, data page, schedule, filing, order, advisory, or statement on doi.gov; preserve the publication or update time and identify the issuing office. Official claims require independent context for disputed or high-risk coverage.', 'link_only',
    'Primary-source registry entry for U.S. Department of the Interior. Use it for attributable facts within its authority; do not treat an official statement as independent confirmation, and verify revisions or preliminary values.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_fcc_gov', 'Federal Communications Commission', 'fcc.gov', 'FCC', 'REGULATOR', 'US', 'United States Government',
    1, 1, 'Link to the exact official record, release, data page, schedule, filing, order, advisory, or statement on fcc.gov; preserve the publication or update time and identify the issuing office. Official claims require independent context for disputed or high-risk coverage.', 'link_only',
    'Primary-source registry entry for Federal Communications Commission. Use it for attributable facts within its authority; do not treat an official statement as independent confirmation, and verify revisions or preliminary values.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_fec_gov', 'Federal Election Commission', 'fec.gov', 'FEC', 'ELECTION_AGENCY', 'US', 'United States Government',
    1, 1, 'Link to the exact official record, release, data page, schedule, filing, order, advisory, or statement on fec.gov; preserve the publication or update time and identify the issuing office. Official claims require independent context for disputed or high-risk coverage.', 'link_only',
    'Primary-source registry entry for Federal Election Commission. Use it for attributable facts within its authority; do not treat an official statement as independent confirmation, and verify revisions or preliminary values.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_eac_gov', 'U.S. Election Assistance Commission', 'eac.gov', 'EAC', 'ELECTION_AGENCY', 'US', 'United States Government',
    1, 1, 'Link to the exact official record, release, data page, schedule, filing, order, advisory, or statement on eac.gov; preserve the publication or update time and identify the issuing office. Official claims require independent context for disputed or high-risk coverage.', 'link_only',
    'Primary-source registry entry for U.S. Election Assistance Commission. Use it for attributable facts within its authority; do not treat an official statement as independent confirmation, and verify revisions or preliminary values.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_nist_gov', 'National Institute of Standards and Technology', 'nist.gov', 'NIST', 'SCIENCE_AGENCY', 'US', 'U.S. Department of Commerce',
    1, 1, 'Link to the exact official record, release, data page, schedule, filing, order, advisory, or statement on nist.gov; preserve the publication or update time and identify the issuing office. Official claims require independent context for disputed or high-risk coverage.', 'link_only',
    'Primary-source registry entry for National Institute of Standards and Technology. Use it for attributable facts within its authority; do not treat an official statement as independent confirmation, and verify revisions or preliminary values.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_nfl_com', 'National Football League', 'nfl.com', 'NFL', 'SPORTS_ORGANIZATION', 'US', 'National Football League',
    1, 1, 'Link to the exact official record, release, data page, schedule, filing, order, advisory, or statement on nfl.com; preserve the publication or update time and identify the issuing office. Official claims require independent context for disputed or high-risk coverage.', 'link_only',
    'Primary-source registry entry for National Football League. Use it for attributable facts within its authority; do not treat an official statement as independent confirmation, and verify revisions or preliminary values.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_nba_com', 'National Basketball Association', 'nba.com', 'NBA', 'SPORTS_ORGANIZATION', 'US', 'National Basketball Association',
    1, 1, 'Link to the exact official record, release, data page, schedule, filing, order, advisory, or statement on nba.com; preserve the publication or update time and identify the issuing office. Official claims require independent context for disputed or high-risk coverage.', 'link_only',
    'Primary-source registry entry for National Basketball Association. Use it for attributable facts within its authority; do not treat an official statement as independent confirmation, and verify revisions or preliminary values.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_mlb_com', 'Major League Baseball', 'mlb.com', 'MLB', 'SPORTS_ORGANIZATION', 'US', 'Major League Baseball',
    1, 1, 'Link to the exact official record, release, data page, schedule, filing, order, advisory, or statement on mlb.com; preserve the publication or update time and identify the issuing office. Official claims require independent context for disputed or high-risk coverage.', 'link_only',
    'Primary-source registry entry for Major League Baseball. Use it for attributable facts within its authority; do not treat an official statement as independent confirmation, and verify revisions or preliminary values.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_nhl_com', 'National Hockey League', 'nhl.com', 'NHL', 'SPORTS_ORGANIZATION', 'US', 'National Hockey League',
    1, 1, 'Link to the exact official record, release, data page, schedule, filing, order, advisory, or statement on nhl.com; preserve the publication or update time and identify the issuing office. Official claims require independent context for disputed or high-risk coverage.', 'link_only',
    'Primary-source registry entry for National Hockey League. Use it for attributable facts within its authority; do not treat an official statement as independent confirmation, and verify revisions or preliminary values.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_ncaa_com', 'NCAA', 'ncaa.com', 'NCAA', 'SPORTS_ORGANIZATION', 'US', 'National Collegiate Athletic Association',
    1, 1, 'Link to the exact official record, release, data page, schedule, filing, order, advisory, or statement on ncaa.com; preserve the publication or update time and identify the issuing office. Official claims require independent context for disputed or high-risk coverage.', 'link_only',
    'Primary-source registry entry for NCAA. Use it for attributable facts within its authority; do not treat an official statement as independent confirmation, and verify revisions or preliminary values.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_reuters_com', 'Reuters', 'reuters.com', 'Reuters', 'WIRE', 'GB', 'Reuters News & Media',
    2, 0, 'Attribute Reuters and the named reporter or desk when available; link to the exact report on reuters.com; do not count syndicated or copied versions as separate independent confirmation and do not reproduce protected text or media.', 'link_only',
    'Established independent or specialist publication used for reporting, interviews, and corroboration. Central sensitive claims should still be checked against primary records and an additional independent source.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_apnews_com', 'Associated Press', 'apnews.com', 'Associated Press', 'WIRE', 'US', 'The Associated Press',
    2, 0, 'Attribute Associated Press and the named reporter or desk when available; link to the exact report on apnews.com; do not count syndicated or copied versions as separate independent confirmation and do not reproduce protected text or media.', 'link_only',
    'Established independent or specialist publication used for reporting, interviews, and corroboration. Central sensitive claims should still be checked against primary records and an additional independent source.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_npr_org', 'NPR', 'npr.org', 'NPR', 'NEWSROOM', 'US', 'National Public Radio, Inc.',
    2, 0, 'Attribute NPR and the named reporter or desk when available; link to the exact report on npr.org; do not count syndicated or copied versions as separate independent confirmation and do not reproduce protected text or media.', 'link_only',
    'Established independent or specialist publication used for reporting, interviews, and corroboration. Central sensitive claims should still be checked against primary records and an additional independent source.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_pbs_org', 'PBS NewsHour', 'pbs.org', 'PBS NewsHour', 'NEWSROOM', 'US', 'Public Broadcasting Service',
    2, 0, 'Attribute PBS NewsHour and the named reporter or desk when available; link to the exact report on pbs.org; do not count syndicated or copied versions as separate independent confirmation and do not reproduce protected text or media.', 'link_only',
    'Established independent or specialist publication used for reporting, interviews, and corroboration. Central sensitive claims should still be checked against primary records and an additional independent source.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_bbc_com', 'BBC News', 'bbc.com', 'BBC News', 'NEWSROOM', 'GB', 'British Broadcasting Corporation',
    2, 0, 'Attribute BBC News and the named reporter or desk when available; link to the exact report on bbc.com; do not count syndicated or copied versions as separate independent confirmation and do not reproduce protected text or media.', 'link_only',
    'Established independent or specialist publication used for reporting, interviews, and corroboration. Central sensitive claims should still be checked against primary records and an additional independent source.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_cnn_com', 'CNN', 'cnn.com', 'CNN', 'NEWSROOM', 'US', 'Warner Bros. Discovery',
    2, 0, 'Attribute CNN and the named reporter or desk when available; link to the exact report on cnn.com; do not count syndicated or copied versions as separate independent confirmation and do not reproduce protected text or media.', 'link_only',
    'Established independent or specialist publication used for reporting, interviews, and corroboration. Central sensitive claims should still be checked against primary records and an additional independent source.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_nbcnews_com', 'NBC News', 'nbcnews.com', 'NBC News', 'NEWSROOM', 'US', 'NBCUniversal',
    2, 0, 'Attribute NBC News and the named reporter or desk when available; link to the exact report on nbcnews.com; do not count syndicated or copied versions as separate independent confirmation and do not reproduce protected text or media.', 'link_only',
    'Established independent or specialist publication used for reporting, interviews, and corroboration. Central sensitive claims should still be checked against primary records and an additional independent source.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_abcnews_go_com', 'ABC News', 'abcnews.go.com', 'ABC News', 'NEWSROOM', 'US', 'The Walt Disney Company',
    2, 0, 'Attribute ABC News and the named reporter or desk when available; link to the exact report on abcnews.go.com; do not count syndicated or copied versions as separate independent confirmation and do not reproduce protected text or media.', 'link_only',
    'Established independent or specialist publication used for reporting, interviews, and corroboration. Central sensitive claims should still be checked against primary records and an additional independent source.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_cbsnews_com', 'CBS News', 'cbsnews.com', 'CBS News', 'NEWSROOM', 'US', 'Paramount Global',
    2, 0, 'Attribute CBS News and the named reporter or desk when available; link to the exact report on cbsnews.com; do not count syndicated or copied versions as separate independent confirmation and do not reproduce protected text or media.', 'link_only',
    'Established independent or specialist publication used for reporting, interviews, and corroboration. Central sensitive claims should still be checked against primary records and an additional independent source.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_foxnews_com', 'Fox News', 'foxnews.com', 'Fox News', 'NEWSROOM', 'US', 'Fox Corporation',
    2, 0, 'Attribute Fox News and the named reporter or desk when available; link to the exact report on foxnews.com; do not count syndicated or copied versions as separate independent confirmation and do not reproduce protected text or media.', 'link_only',
    'Established independent or specialist publication used for reporting, interviews, and corroboration. Central sensitive claims should still be checked against primary records and an additional independent source.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_usatoday_com', 'USA Today', 'usatoday.com', 'USA Today', 'NEWSROOM', 'US', 'Gannett',
    2, 0, 'Attribute USA Today and the named reporter or desk when available; link to the exact report on usatoday.com; do not count syndicated or copied versions as separate independent confirmation and do not reproduce protected text or media.', 'link_only',
    'Established independent or specialist publication used for reporting, interviews, and corroboration. Central sensitive claims should still be checked against primary records and an additional independent source.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_nytimes_com', 'The New York Times', 'nytimes.com', 'The New York Times', 'NEWSROOM', 'US', 'The New York Times Company',
    2, 0, 'Attribute The New York Times and the named reporter or desk when available; link to the exact report on nytimes.com; do not count syndicated or copied versions as separate independent confirmation and do not reproduce protected text or media.', 'link_only',
    'Established independent or specialist publication used for reporting, interviews, and corroboration. Central sensitive claims should still be checked against primary records and an additional independent source.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_washingtonpost_com', 'The Washington Post', 'washingtonpost.com', 'The Washington Post', 'NEWSROOM', 'US', 'Nash Holdings',
    2, 0, 'Attribute The Washington Post and the named reporter or desk when available; link to the exact report on washingtonpost.com; do not count syndicated or copied versions as separate independent confirmation and do not reproduce protected text or media.', 'link_only',
    'Established independent or specialist publication used for reporting, interviews, and corroboration. Central sensitive claims should still be checked against primary records and an additional independent source.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_wsj_com', 'The Wall Street Journal', 'wsj.com', 'The Wall Street Journal', 'NEWSROOM', 'US', 'News Corp',
    2, 0, 'Attribute The Wall Street Journal and the named reporter or desk when available; link to the exact report on wsj.com; do not count syndicated or copied versions as separate independent confirmation and do not reproduce protected text or media.', 'link_only',
    'Established independent or specialist publication used for reporting, interviews, and corroboration. Central sensitive claims should still be checked against primary records and an additional independent source.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_bloomberg_com', 'Bloomberg', 'bloomberg.com', 'Bloomberg', 'NEWSROOM', 'US', 'Bloomberg L.P.',
    2, 0, 'Attribute Bloomberg and the named reporter or desk when available; link to the exact report on bloomberg.com; do not count syndicated or copied versions as separate independent confirmation and do not reproduce protected text or media.', 'link_only',
    'Established independent or specialist publication used for reporting, interviews, and corroboration. Central sensitive claims should still be checked against primary records and an additional independent source.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_cnbc_com', 'CNBC', 'cnbc.com', 'CNBC', 'NEWSROOM', 'US', 'NBCUniversal',
    2, 0, 'Attribute CNBC and the named reporter or desk when available; link to the exact report on cnbc.com; do not count syndicated or copied versions as separate independent confirmation and do not reproduce protected text or media.', 'link_only',
    'Established independent or specialist publication used for reporting, interviews, and corroboration. Central sensitive claims should still be checked against primary records and an additional independent source.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_axios_com', 'Axios', 'axios.com', 'Axios', 'NEWSROOM', 'US', 'Cox Enterprises',
    2, 0, 'Attribute Axios and the named reporter or desk when available; link to the exact report on axios.com; do not count syndicated or copied versions as separate independent confirmation and do not reproduce protected text or media.', 'link_only',
    'Established independent or specialist publication used for reporting, interviews, and corroboration. Central sensitive claims should still be checked against primary records and an additional independent source.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_politico_com', 'Politico', 'politico.com', 'Politico', 'NEWSROOM', 'US', 'Axel Springer',
    2, 0, 'Attribute Politico and the named reporter or desk when available; link to the exact report on politico.com; do not count syndicated or copied versions as separate independent confirmation and do not reproduce protected text or media.', 'link_only',
    'Established independent or specialist publication used for reporting, interviews, and corroboration. Central sensitive claims should still be checked against primary records and an additional independent source.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_propublica_org', 'ProPublica', 'propublica.org', 'ProPublica', 'NONPROFIT_NEWSROOM', 'US', 'ProPublica, Inc.',
    2, 0, 'Attribute ProPublica and the named reporter or desk when available; link to the exact report on propublica.org; do not count syndicated or copied versions as separate independent confirmation and do not reproduce protected text or media.', 'link_only',
    'Established independent or specialist publication used for reporting, interviews, and corroboration. Central sensitive claims should still be checked against primary records and an additional independent source.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_theguardian_com', 'The Guardian', 'theguardian.com', 'The Guardian', 'NEWSROOM', 'GB', 'Guardian Media Group',
    2, 0, 'Attribute The Guardian and the named reporter or desk when available; link to the exact report on theguardian.com; do not count syndicated or copied versions as separate independent confirmation and do not reproduce protected text or media.', 'link_only',
    'Established independent or specialist publication used for reporting, interviews, and corroboration. Central sensitive claims should still be checked against primary records and an additional independent source.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_thehill_com', 'The Hill', 'thehill.com', 'The Hill', 'NEWSROOM', 'US', 'Nexstar Media Group',
    2, 0, 'Attribute The Hill and the named reporter or desk when available; link to the exact report on thehill.com; do not count syndicated or copied versions as separate independent confirmation and do not reproduce protected text or media.', 'link_only',
    'Established independent or specialist publication used for reporting, interviews, and corroboration. Central sensitive claims should still be checked against primary records and an additional independent source.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_latimes_com', 'Los Angeles Times', 'latimes.com', 'Los Angeles Times', 'NEWSROOM', 'US', 'Los Angeles Times Communications',
    2, 0, 'Attribute Los Angeles Times and the named reporter or desk when available; link to the exact report on latimes.com; do not count syndicated or copied versions as separate independent confirmation and do not reproduce protected text or media.', 'link_only',
    'Established independent or specialist publication used for reporting, interviews, and corroboration. Central sensitive claims should still be checked against primary records and an additional independent source.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_chicagotribune_com', 'Chicago Tribune', 'chicagotribune.com', 'Chicago Tribune', 'NEWSROOM', 'US', 'Alden Global Capital',
    2, 0, 'Attribute Chicago Tribune and the named reporter or desk when available; link to the exact report on chicagotribune.com; do not count syndicated or copied versions as separate independent confirmation and do not reproduce protected text or media.', 'link_only',
    'Established independent or specialist publication used for reporting, interviews, and corroboration. Central sensitive claims should still be checked against primary records and an additional independent source.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_bostonglobe_com', 'The Boston Globe', 'bostonglobe.com', 'The Boston Globe', 'NEWSROOM', 'US', 'Boston Globe Media Partners',
    2, 0, 'Attribute The Boston Globe and the named reporter or desk when available; link to the exact report on bostonglobe.com; do not count syndicated or copied versions as separate independent confirmation and do not reproduce protected text or media.', 'link_only',
    'Established independent or specialist publication used for reporting, interviews, and corroboration. Central sensitive claims should still be checked against primary records and an additional independent source.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_inquirer_com', 'The Philadelphia Inquirer', 'inquirer.com', 'The Philadelphia Inquirer', 'NONPROFIT_NEWSROOM', 'US', 'The Lenfest Institute for Journalism',
    2, 0, 'Attribute The Philadelphia Inquirer and the named reporter or desk when available; link to the exact report on inquirer.com; do not count syndicated or copied versions as separate independent confirmation and do not reproduce protected text or media.', 'link_only',
    'Established independent or specialist publication used for reporting, interviews, and corroboration. Central sensitive claims should still be checked against primary records and an additional independent source.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_miamiherald_com', 'Miami Herald', 'miamiherald.com', 'Miami Herald', 'NEWSROOM', 'US', 'McClatchy',
    2, 0, 'Attribute Miami Herald and the named reporter or desk when available; link to the exact report on miamiherald.com; do not count syndicated or copied versions as separate independent confirmation and do not reproduce protected text or media.', 'link_only',
    'Established independent or specialist publication used for reporting, interviews, and corroboration. Central sensitive claims should still be checked against primary records and an additional independent source.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_texastribune_org', 'The Texas Tribune', 'texastribune.org', 'The Texas Tribune', 'NONPROFIT_NEWSROOM', 'US', 'The Texas Tribune, Inc.',
    2, 0, 'Attribute The Texas Tribune and the named reporter or desk when available; link to the exact report on texastribune.org; do not count syndicated or copied versions as separate independent confirmation and do not reproduce protected text or media.', 'link_only',
    'Established independent or specialist publication used for reporting, interviews, and corroboration. Central sensitive claims should still be checked against primary records and an additional independent source.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_seattletimes_com', 'The Seattle Times', 'seattletimes.com', 'The Seattle Times', 'NEWSROOM', 'US', 'The Seattle Times Company',
    2, 0, 'Attribute The Seattle Times and the named reporter or desk when available; link to the exact report on seattletimes.com; do not count syndicated or copied versions as separate independent confirmation and do not reproduce protected text or media.', 'link_only',
    'Established independent or specialist publication used for reporting, interviews, and corroboration. Central sensitive claims should still be checked against primary records and an additional independent source.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_sfchronicle_com', 'San Francisco Chronicle', 'sfchronicle.com', 'San Francisco Chronicle', 'NEWSROOM', 'US', 'Hearst Communications',
    2, 0, 'Attribute San Francisco Chronicle and the named reporter or desk when available; link to the exact report on sfchronicle.com; do not count syndicated or copied versions as separate independent confirmation and do not reproduce protected text or media.', 'link_only',
    'Established independent or specialist publication used for reporting, interviews, and corroboration. Central sensitive claims should still be checked against primary records and an additional independent source.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_theverge_com', 'The Verge', 'theverge.com', 'The Verge', 'SPECIALIST_NEWSROOM', 'US', 'Vox Media',
    2, 0, 'Attribute The Verge and the named reporter or desk when available; link to the exact report on theverge.com; do not count syndicated or copied versions as separate independent confirmation and do not reproduce protected text or media.', 'link_only',
    'Established independent or specialist publication used for reporting, interviews, and corroboration. Central sensitive claims should still be checked against primary records and an additional independent source.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_arstechnica_com', 'Ars Technica', 'arstechnica.com', 'Ars Technica', 'SPECIALIST_NEWSROOM', 'US', 'Condé Nast',
    2, 0, 'Attribute Ars Technica and the named reporter or desk when available; link to the exact report on arstechnica.com; do not count syndicated or copied versions as separate independent confirmation and do not reproduce protected text or media.', 'link_only',
    'Established independent or specialist publication used for reporting, interviews, and corroboration. Central sensitive claims should still be checked against primary records and an additional independent source.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_wired_com', 'WIRED', 'wired.com', 'WIRED', 'SPECIALIST_NEWSROOM', 'US', 'Condé Nast',
    2, 0, 'Attribute WIRED and the named reporter or desk when available; link to the exact report on wired.com; do not count syndicated or copied versions as separate independent confirmation and do not reproduce protected text or media.', 'link_only',
    'Established independent or specialist publication used for reporting, interviews, and corroboration. Central sensitive claims should still be checked against primary records and an additional independent source.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_techcrunch_com', 'TechCrunch', 'techcrunch.com', 'TechCrunch', 'SPECIALIST_NEWSROOM', 'US', 'Yahoo Inc.',
    2, 0, 'Attribute TechCrunch and the named reporter or desk when available; link to the exact report on techcrunch.com; do not count syndicated or copied versions as separate independent confirmation and do not reproduce protected text or media.', 'link_only',
    'Established independent or specialist publication used for reporting, interviews, and corroboration. Central sensitive claims should still be checked against primary records and an additional independent source.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_scientificamerican_com', 'Scientific American', 'scientificamerican.com', 'Scientific American', 'SCIENCE_NEWSROOM', 'US', 'Springer Nature',
    2, 0, 'Attribute Scientific American and the named reporter or desk when available; link to the exact report on scientificamerican.com; do not count syndicated or copied versions as separate independent confirmation and do not reproduce protected text or media.', 'link_only',
    'Established independent or specialist publication used for reporting, interviews, and corroboration. Central sensitive claims should still be checked against primary records and an additional independent source.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_nature_com', 'Nature', 'nature.com', 'Nature', 'SCIENTIFIC_JOURNAL', 'GB', 'Springer Nature',
    2, 0, 'Attribute Nature and the named reporter or desk when available; link to the exact report on nature.com; do not count syndicated or copied versions as separate independent confirmation and do not reproduce protected text or media.', 'link_only',
    'Established independent or specialist publication used for reporting, interviews, and corroboration. Central sensitive claims should still be checked against primary records and an additional independent source.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_science_org', 'Science', 'science.org', 'Science', 'SCIENTIFIC_JOURNAL', 'US', 'American Association for the Advancement of Science',
    2, 0, 'Attribute Science and the named reporter or desk when available; link to the exact report on science.org; do not count syndicated or copied versions as separate independent confirmation and do not reproduce protected text or media.', 'link_only',
    'Established independent or specialist publication used for reporting, interviews, and corroboration. Central sensitive claims should still be checked against primary records and an additional independent source.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_espn_com', 'ESPN', 'espn.com', 'ESPN', 'SPORTS_NEWSROOM', 'US', 'ESPN, Inc.',
    2, 0, 'Attribute ESPN and the named reporter or desk when available; link to the exact report on espn.com; do not count syndicated or copied versions as separate independent confirmation and do not reproduce protected text or media.', 'link_only',
    'Established independent or specialist publication used for reporting, interviews, and corroboration. Central sensitive claims should still be checked against primary records and an additional independent source.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  ),
  (
    'source_cbssports_com', 'CBS Sports', 'cbssports.com', 'CBS Sports', 'SPORTS_NEWSROOM', 'US', 'Paramount Global',
    2, 0, 'Attribute CBS Sports and the named reporter or desk when available; link to the exact report on cbssports.com; do not count syndicated or copied versions as separate independent confirmation and do not reproduce protected text or media.', 'link_only',
    'Established independent or specialist publication used for reporting, interviews, and corroboration. Central sensitive claims should still be checked against primary records and an additional independent source.', unixepoch() * 1000, unixepoch() * 1000, unixepoch() * 1000
  )
ON CONFLICT(domain) DO UPDATE SET
  name = excluded.name,
  publisher = excluded.publisher,
  source_type = excluded.source_type,
  country = excluded.country,
  ownership = excluded.ownership,
  credibility_tier = excluded.credibility_tier,
  is_primary = excluded.is_primary,
  citation_requirements = excluded.citation_requirements,
  licensing_status = excluded.licensing_status,
  reliability_notes = excluded.reliability_notes,
  last_reviewed_at = excluded.last_reviewed_at,
  updated_at = excluded.updated_at;

INSERT INTO audit_logs (
  id, actor_id, action, target_type, target_id, decision,
  reason, metadata_json, occurred_at
) VALUES (
  'audit_source_registry_seed_v12_100',
  NULL,
  'SOURCE_REGISTRY_SEEDED',
  'SOURCE_REGISTRY',
  'us-editorial-registry-100',
  'ALLOWED',
  'Idempotent reviewed U.S. source registry applied through the versioned SQL seed.',
  '{"sourceCount":100,"primaryCount":62,"independentCount":38,"rightsDefault":"link_only","version":"v12.1"}',
  unixepoch() * 1000
)
ON CONFLICT(id) DO UPDATE SET
  reason = excluded.reason,
  metadata_json = excluded.metadata_json,
  occurred_at = excluded.occurred_at;
