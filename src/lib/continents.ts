/**
 * Continent lookup and map palette for the home-page globe.
 *
 * Keyed by the country names in `world-atlas/countries-110m.json` (177 features).
 * Keyed by name rather than ISO id because a few features carry no numeric id at
 * all — Kosovo, N. Cyprus and Somaliland are all `undefined` there.
 *
 * The palette is a muted vintage-atlas set rather than bright political-map
 * colours: it has to sit on a cream page next to a maroon-and-gold brand without
 * turning the hero into a rainbow. Africa leans on the brand gold and Asia on the
 * brand maroon so the globe still reads as part of the identity.
 */

export type Continent =
  | 'africa'
  | 'asia'
  | 'europe'
  | 'northAmerica'
  | 'southAmerica'
  | 'oceania'
  | 'antarctica';

export const CONTINENT_COLORS: Record<Continent, string> = {
  africa: '#E0B25C', // gold-sand, echoes the brand gold
  asia: '#B5604A', // terracotta, echoes the brand maroon
  europe: '#8FA870', // sage
  northAmerica: '#D08E5C', // amber tan
  southAmerica: '#7FA98E', // muted green
  oceania: '#C77F6B', // clay
  antarctica: '#E8EDEF', // ice
};

/** Land that is not matched below — should not happen, but must still draw. */
export const FALLBACK_LAND = '#C08A5E';

const MEMBERS: Record<Continent, string[]> = {
  africa: [
    'Algeria', 'Angola', 'Benin', 'Botswana', 'Burkina Faso', 'Burundi', 'Cameroon',
    'Central African Rep.', 'Chad', 'Congo', "Côte d'Ivoire", 'Dem. Rep. Congo',
    'Djibouti', 'Egypt', 'Eq. Guinea', 'Eritrea', 'eSwatini', 'Ethiopia', 'Gabon',
    'Gambia', 'Ghana', 'Guinea', 'Guinea-Bissau', 'Kenya', 'Lesotho', 'Liberia',
    'Libya', 'Madagascar', 'Malawi', 'Mali', 'Mauritania', 'Morocco', 'Mozambique',
    'Namibia', 'Niger', 'Nigeria', 'Rwanda', 'S. Sudan', 'Senegal', 'Sierra Leone',
    'Somalia', 'Somaliland', 'South Africa', 'Sudan', 'Tanzania', 'Togo', 'Tunisia',
    'Uganda', 'W. Sahara', 'Zambia', 'Zimbabwe',
  ],
  asia: [
    'Afghanistan', 'Armenia', 'Azerbaijan', 'Bangladesh', 'Bhutan', 'Brunei',
    'Cambodia', 'China', 'Cyprus', 'Georgia', 'India', 'Indonesia', 'Iran', 'Iraq',
    'Israel', 'Japan', 'Jordan', 'Kazakhstan', 'Kuwait', 'Kyrgyzstan', 'Laos',
    'Lebanon', 'Malaysia', 'Mongolia', 'Myanmar', 'N. Cyprus', 'Nepal',
    'North Korea', 'Oman', 'Pakistan', 'Palestine', 'Philippines', 'Qatar',
    'Saudi Arabia', 'South Korea', 'Sri Lanka', 'Syria', 'Taiwan', 'Tajikistan',
    'Thailand', 'Timor-Leste', 'Turkey', 'Turkmenistan', 'United Arab Emirates',
    'Uzbekistan', 'Vietnam', 'Yemen',
  ],
  europe: [
    'Albania', 'Austria', 'Belarus', 'Belgium', 'Bosnia and Herz.', 'Bulgaria',
    'Croatia', 'Czechia', 'Denmark', 'Estonia', 'Finland', 'France', 'Germany',
    'Greece', 'Hungary', 'Iceland', 'Ireland', 'Italy', 'Kosovo', 'Latvia',
    'Lithuania', 'Luxembourg', 'Macedonia', 'Moldova', 'Montenegro', 'Netherlands',
    'Norway', 'Poland', 'Portugal', 'Romania', 'Russia', 'Serbia', 'Slovakia',
    'Slovenia', 'Spain', 'Sweden', 'Switzerland', 'Ukraine', 'United Kingdom',
  ],
  northAmerica: [
    'Bahamas', 'Belize', 'Canada', 'Costa Rica', 'Cuba', 'Dominican Rep.',
    'El Salvador', 'Greenland', 'Guatemala', 'Haiti', 'Honduras', 'Jamaica',
    'Mexico', 'Nicaragua', 'Panama', 'Puerto Rico', 'Trinidad and Tobago',
    'United States of America',
  ],
  southAmerica: [
    'Argentina', 'Bolivia', 'Brazil', 'Chile', 'Colombia', 'Ecuador',
    'Falkland Is.', 'Guyana', 'Paraguay', 'Peru', 'Suriname', 'Uruguay', 'Venezuela',
  ],
  oceania: [
    'Australia', 'Fiji', 'New Caledonia', 'New Zealand', 'Papua New Guinea',
    'Solomon Is.', 'Vanuatu',
  ],
  antarctica: ['Antarctica', 'Fr. S. Antarctic Lands'],
};

const BY_NAME = new Map<string, Continent>();
for (const [continent, names] of Object.entries(MEMBERS) as [Continent, string[]][]) {
  for (const name of names) BY_NAME.set(name, continent);
}

export function continentOf(countryName: string | undefined): Continent | undefined {
  return countryName ? BY_NAME.get(countryName) : undefined;
}

export function landColorFor(countryName: string | undefined): string {
  const continent = continentOf(countryName);
  return continent ? CONTINENT_COLORS[continent] : FALLBACK_LAND;
}
