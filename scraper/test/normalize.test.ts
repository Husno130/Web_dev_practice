import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MARLA_PER_KANAL,
  SQFT_PER_KANAL,
  SQFT_PER_MARLA,
  SQFT_PER_SQYD,
  SQFT_PER_SQM,
  areaUnitToSqft,
  parseArea,
} from '../src/lib/units.js';
import {
  computeContentHash,
  extractCoordinates,
  extractSector,
  parsePricePkr,
  toScrapedListing,
} from '../src/lib/normalize.js';

// ---------------------------------------------------------------------------
// Unit conversion constants
// ---------------------------------------------------------------------------

test('unit conversion constants match the project spec', () => {
  assert.equal(SQFT_PER_MARLA, 272.25);
  assert.equal(MARLA_PER_KANAL, 20);
  assert.equal(SQFT_PER_KANAL, 5445);
  assert.equal(SQFT_PER_SQYD, 9);
  assert.equal(SQFT_PER_SQM, 10.7639);
  assert.equal(areaUnitToSqft(2, 'marla'), 544.5);
  assert.equal(areaUnitToSqft(3, 'kanal'), 16335);
  assert.equal(areaUnitToSqft(10, 'sqyd'), 90);
});

// ---------------------------------------------------------------------------
// parseArea
// ---------------------------------------------------------------------------

test('parseArea handles marla values', () => {
  const ten = parseArea('10 Marla');
  assert.deepEqual(ten, { area_value: 10, area_unit: 'marla', area_sqft: 2722.5 });

  const fivePointFive = parseArea('5.5 Marla');
  assert.deepEqual(fivePointFive, {
    area_value: 5.5,
    area_unit: 'marla',
    area_sqft: 1497.38,
  });
});

test('parseArea handles kanal values', () => {
  assert.deepEqual(parseArea('1 Kanal'), {
    area_value: 1,
    area_unit: 'kanal',
    area_sqft: 5445,
  });
  assert.deepEqual(parseArea('1.5 Kanal'), {
    area_value: 1.5,
    area_unit: 'kanal',
    area_sqft: 8167.5,
  });
});

test('parseArea handles sqft and sqyd spellings', () => {
  assert.deepEqual(parseArea('1200 sqft'), {
    area_value: 1200,
    area_unit: 'sqft',
    area_sqft: 1200,
  });
  assert.deepEqual(parseArea('1200 Sq. Ft.'), {
    area_value: 1200,
    area_unit: 'sqft',
    area_sqft: 1200,
  });
  assert.deepEqual(parseArea('150 sqyd'), {
    area_value: 150,
    area_unit: 'sqyd',
    area_sqft: 1350,
  });
  assert.deepEqual(parseArea('150 Sq. Yd.'), {
    area_value: 150,
    area_unit: 'sqyd',
    area_sqft: 1350,
  });
});

test('parseArea compounds mixed units and returns nulls for junk', () => {
  // 1 kanal + 5 marla = 5445 + 1361.25 = 6806.25
  const compound = parseArea('1 Kanal 5 Marla');
  assert.equal(compound.area_unit, 'kanal');
  assert.equal(compound.area_sqft, 6806.25);
  assert.equal(compound.area_value, 1.25);

  assert.deepEqual(parseArea(''), { area_value: null, area_unit: null, area_sqft: null });
  assert.deepEqual(parseArea('no area here'), {
    area_value: null,
    area_unit: null,
    area_sqft: null,
  });
});

// ---------------------------------------------------------------------------
// parsePricePkr
// ---------------------------------------------------------------------------

test('parsePricePkr handles crore / lakh / arab notation', () => {
  assert.equal(parsePricePkr('1.5 Crore'), 15_000_000);
  assert.equal(parsePricePkr('1.5 Cr'), 15_000_000);
  assert.equal(parsePricePkr('45 Lakh'), 4_500_000);
  assert.equal(parsePricePkr('45 Lac'), 4_500_000);
  // 1 Arab = 100 crore = 10^9.
  assert.equal(parsePricePkr('2 Arab'), 2_000_000_000);
});

test('parsePricePkr handles grouped and prefixed numbers', () => {
  assert.equal(parsePricePkr('PKR 2,50,00,000'), 25_000_000);
  assert.equal(parsePricePkr('Rs 25000000'), 25_000_000);
  assert.equal(parsePricePkr('2,50,00,000'), 25_000_000);
  assert.equal(parsePricePkr('Rs. 75,00,000/-'), 7_500_000);
});

test('parsePricePkr returns null when no number is present', () => {
  assert.equal(parsePricePkr('Price on call'), null);
  assert.equal(parsePricePkr(''), null);
  assert.equal(parsePricePkr(null), null);
  assert.equal(parsePricePkr(undefined), null);
});

test('parsePricePkr prefers an explicit full number over multipliers', () => {
  assert.equal(parsePricePkr('Rs 45 Lac (4,500,000)'), 4_500_000);
});

// ---------------------------------------------------------------------------
// extractSector
// ---------------------------------------------------------------------------

test('extractSector recognises sector codes', () => {
  assert.equal(extractSector('G-13, Islamabad'), 'G-13');
  assert.equal(extractSector('Plot in G-11 Islamabad'), 'G-11');
  assert.equal(extractSector('F-11/3, Islamabad'), 'F-11');
  assert.equal(extractSector('E-11 Markaz'), 'E-11');
  assert.equal(extractSector('D-12, Islamabad'), 'D-12');
  assert.equal(extractSector('I-8'), 'I-8');
  assert.equal(extractSector('H-13'), 'H-13');
  assert.equal(extractSector('B-17'), 'B-17');
});

test('extractSector recognises societies (longest match wins via ordering)', () => {
  assert.equal(extractSector('DHA Phase 2, Islamabad'), 'DHA Islamabad');
  assert.equal(extractSector('Bahria Town Phase 8'), 'Bahria Town');
  assert.equal(extractSector('Gulberg Greens'), 'Gulberg');
  assert.equal(extractSector('PWD Road, Islamabad'), 'PWD');
  assert.equal(extractSector('Top City-1'), 'Top City');
  assert.equal(extractSector('Capital Smart City'), 'Capital Smart City');
  assert.equal(extractSector('Multi Gardens B-17'), 'Multi Gardens');
  assert.equal(extractSector('Airport Enclave'), 'Airport Enclave');
});

test('extractSector returns null for unrecognised locations', () => {
  assert.equal(extractSector('Some random village'), null);
  assert.equal(extractSector(''), null);
  assert.equal(extractSector(null), null);
});

// ---------------------------------------------------------------------------
// computeContentHash
// ---------------------------------------------------------------------------

test('computeContentHash is deterministic and order-insensitive', () => {
  const a = computeContentHash({ a: 1, b: 2 });
  const b = computeContentHash({ b: 2, a: 1 });
  assert.equal(a, b);
  assert.equal(a.length, 32);
  assert.notEqual(a, computeContentHash({ a: 1, b: 3 }));
});

// ---------------------------------------------------------------------------
// extractCoordinates + toScrapedListing
// ---------------------------------------------------------------------------

test('extractCoordinates reads latitude/longitude in either order', () => {
  assert.deepEqual(extractCoordinates('{"latitude":33.6844,"longitude":73.0479}'), {
    latitude: 33.6844,
    longitude: 73.0479,
  });
  assert.deepEqual(extractCoordinates('"longitude": 73.0479, "latitude": 33.6844'), {
    latitude: 33.6844,
    longitude: 73.0479,
  });
  assert.equal(extractCoordinates('<html></html>'), null);
});

test('toScrapedListing normalises a RawCard into the p_items shape', () => {
  const listing = toScrapedListing(
    {
      sourceListingId: '1234567',
      sourceUrl: 'https://www.zameen.com/Property/x-1234567.html',
      title: '10 Marla Plot In G-13',
      description: 'Nice plot',
      purpose: null,
      propertyType: null,
      priceText: 'Rs 2,50,00,000',
      location: 'G-13, Islamabad',
      areaText: '10 Marla',
      bedrooms: null,
      bathrooms: null,
      latitude: null,
      longitude: null,
      raw: { anything: true },
    },
    { source: 'zameen', city: 'Islamabad', storeRaw: true },
  );

  assert.ok(listing);
  assert.equal(listing.source_listing_id, '1234567');
  assert.equal(listing.purpose, 'sale');
  assert.equal(listing.property_type, 'plot');
  assert.equal(listing.price_pkr, 25_000_000);
  assert.equal(listing.city, 'Islamabad');
  assert.equal(listing.sector, 'G-13');
  assert.equal(listing.area_value, 10);
  assert.equal(listing.area_unit, 'marla');
  assert.equal(listing.area_sqft, 2722.5);
  assert.equal(listing.content_hash.length, 32);
  assert.deepEqual(listing.raw, { anything: true });

  const noRaw = toScrapedListing(
    {
      sourceListingId: '1',
      sourceUrl: 'https://x/property/1',
      title: null,
      description: null,
      purpose: null,
      propertyType: null,
      priceText: null,
      location: null,
      areaText: null,
      bedrooms: null,
      bathrooms: null,
      latitude: null,
      longitude: null,
    },
    { source: 'graana', city: 'Islamabad', storeRaw: false },
  );
  assert.ok(noRaw);
  assert.equal('raw' in noRaw, false);
  assert.equal(noRaw.purpose, 'sale');
});
