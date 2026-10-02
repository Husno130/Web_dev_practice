import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { parseZameenHtml, parseZameenListingId } from '../src/parsers/zameen.js';
import { parseGraanaHtml, parseGraanaListingId } from '../src/parsers/graana.js';
import { toScrapedListing } from '../src/lib/normalize.js';

const ZAMEEN_BASE = 'https://www.zameen.com/Plots/Islamabad-3-1.html';
const GRAANA_BASE = 'https://www.graana.com/sale/islamabad/plots/';

function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
}

// ---------------------------------------------------------------------------
// Zameen parser
// ---------------------------------------------------------------------------

test('parseZameenHtml extracts every card from the fixture', () => {
  const cards = parseZameenHtml(fixture('zameen-islamabad.html'), ZAMEEN_BASE);
  assert.equal(cards.length, 4);
});

test('parseZameenHtml extracts the expected fields from the first card', () => {
  const [first] = parseZameenHtml(fixture('zameen-islamabad.html'), ZAMEEN_BASE);
  assert.ok(first);
  assert.equal(first.sourceListingId, '1234567');
  assert.equal(
    first.sourceUrl,
    'https://www.zameen.com/Property/10-marla-residential-plot-in-g-13-islamabad-1234567.html',
  );
  assert.equal(first.title, '10 Marla Residential Plot In G-13');
  assert.equal(first.priceText, 'Rs 2,50,00,000');
  assert.equal(first.location, 'G-13, Islamabad');
  assert.equal(first.areaText, '10 Marla');
  assert.match(first.description ?? '', /Sector G-13/);
});

test('parseZameenHtml skips cards without an href', () => {
  const html = `
    <ul>
      <li data-aut-id="itemBox"><div data-aut-id="itemTitle">No link here</div></li>
      <li data-aut-id="itemBox">
        <a href="/Property/valid-plot-9999999.html">
          <div data-aut-id="itemTitle">Valid</div>
        </a>
      </li>
    </ul>`;
  const cards = parseZameenHtml(html, ZAMEEN_BASE);
  assert.equal(cards.length, 1);
  assert.equal(cards[0]?.sourceListingId, '9999999');
});

test('parseZameenHtml falls back to embedded JSON when no cards match', () => {
  const html = `
    <html><body>
      <script type="application/ld+json">
      {
        "@type": "Product",
        "name": "20 Marla Plot in DHA",
        "url": "https://www.zameen.com/Property/20-marla-plot-dha-7654321.html",
        "price": "PKR 4,00,00,000",
        "location": "DHA Phase 1, Islamabad",
        "area": "20 Marla"
      }
      </script>
    </body></html>`;
  const cards = parseZameenHtml(html, ZAMEEN_BASE);
  assert.equal(cards.length, 1);
  assert.equal(cards[0]?.sourceListingId, '7654321');
  assert.equal(cards[0]?.title, '20 Marla Plot in DHA');
});

test('parseZameenListingId parses ids from property URLs', () => {
  assert.equal(
    parseZameenListingId('/Property/foo-bar-1234567.html'),
    '1234567',
  );
  assert.equal(parseZameenListingId('https://www.zameen.com/Property/x-99999.html'), '99999');
  assert.equal(parseZameenListingId('/about/us'), null);
});

// ---------------------------------------------------------------------------
// Graana parser
// ---------------------------------------------------------------------------

test('parseGraanaHtml extracts every card from the fixture', () => {
  const cards = parseGraanaHtml(fixture('graana-islamabad.html'), GRAANA_BASE);
  assert.equal(cards.length, 4);
});

test('parseGraanaHtml extracts the expected fields from the first card', () => {
  const [first] = parseGraanaHtml(fixture('graana-islamabad.html'), GRAANA_BASE);
  assert.ok(first);
  assert.equal(first.sourceListingId, '987654');
  assert.equal(
    first.sourceUrl,
    'https://www.graana.com/property/5-marla-plot-g-11-islamabad-987654/',
  );
  assert.equal(first.title, '5 Marla Plot for Sale in G-11');
  assert.equal(first.priceText, 'PKR 1.5 Crore');
  assert.equal(first.location, 'G-11, Islamabad');
  assert.equal(first.areaText, '5 Marla');
});

test('parseGraanaHtml falls back to bare property anchors', () => {
  const html = `
    <div class="result">
      <a href="https://www.graana.com/property/8-marla-plot-f-10-islamabad-555555/">
        <h3>8 Marla Plot in F-10</h3>
        <span class="price">Rs 80 Lakh</span>
        <span class="location">F-10, Islamabad</span>
        <span class="size">8 Marla</span>
      </a>
    </div>`;
  const cards = parseGraanaHtml(html, GRAANA_BASE);
  assert.equal(cards.length, 1);
  assert.equal(cards[0]?.sourceListingId, '555555');
  assert.equal(cards[0]?.priceText, 'Rs 80 Lakh');
});

test('parseGraanaListingId parses ids from property URLs', () => {
  assert.equal(
    parseGraanaListingId('https://www.graana.com/property/foo-987654/'),
    '987654',
  );
  assert.equal(parseGraanaListingId('https://www.graana.com/about/'), null);
});

// ---------------------------------------------------------------------------
// Parser -> normalisation integration
// ---------------------------------------------------------------------------

test('Zameen fixture maps to normalised ScrapedListings', () => {
  const cards = parseZameenHtml(fixture('zameen-islamabad.html'), ZAMEEN_BASE);
  const listings = cards
    .map((card) => toScrapedListing(card, { source: 'zameen', city: 'Islamabad' }))
    .filter((l): l is NonNullable<typeof l> => l !== null);

  assert.equal(listings.length, 4);

  const [first] = listings;
  assert.ok(first);
  assert.equal(first.price_pkr, 25_000_000);
  assert.equal(first.sector, 'G-13');
  assert.equal(first.area_sqft, 2722.5);

  assert.equal(listings[1]?.price_pkr, 15_000_000);
  assert.equal(listings[1]?.sector, 'DHA Islamabad');
  assert.equal(listings[1]?.area_sqft, 5445);

  assert.equal(listings[2]?.price_pkr, 4_500_000);
  assert.equal(listings[2]?.sector, 'Bahria Town');

  assert.equal(listings[3]?.area_unit, 'sqft');
  assert.equal(listings[3]?.area_sqft, 1200);
  assert.equal(listings[3]?.price_pkr, 12_000_000);
});

test('Graana fixture maps to normalised ScrapedListings', () => {
  const cards = parseGraanaHtml(fixture('graana-islamabad.html'), GRAANA_BASE);
  const listings = cards
    .map((card) => toScrapedListing(card, { source: 'graana', city: 'Islamabad' }))
    .filter((l): l is NonNullable<typeof l> => l !== null);

  assert.equal(listings.length, 4);
  assert.equal(listings[0]?.price_pkr, 15_000_000);
  assert.equal(listings[0]?.sector, 'G-11');
  assert.equal(listings[0]?.area_sqft, 1361.25);
  assert.equal(listings[3]?.area_unit, 'sqyd');
  assert.equal(listings[3]?.area_sqft, 1350);
});
