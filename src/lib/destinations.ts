export interface Destination {
  /** [longitude, latitude] — d3-geo order, not lat/lon. */
  coord: [number, number];
  name: string;
  info: string;
}

/**
 * Institutions plotted on the home-page globe.
 *
 * IMPORTANT — these are illustrative of where students apply, NOT a claim of
 * placement, affiliation, or admission outcomes. The globe carries the same
 * disclaimer the campus photography does, for the same reason: naming selective
 * universities on an admissions consultancy's home page invites exactly the
 * inference the Scope of Services policy disclaims ("Admission to any college or
 * university cannot be guaranteed").
 *
 * Flagged in CONTENT-REVIEW.md for the owner's and counsel's sign-off.
 */
export const DESTINATIONS: Destination[] = [
  {
    coord: [-71.0942, 42.3601],
    name: 'MIT',
    info: 'The Massachusetts Institute of Technology is a world-leading institution in research, innovation, and education, especially in science and engineering.',
  },
  {
    coord: [-122.1697, 37.4275],
    name: 'Stanford University',
    info: 'Stanford University is a prestigious private research university located in California, known for its academic excellence and proximity to Silicon Valley.',
  },
  {
    coord: [-71.1167, 42.377],
    name: 'Harvard University',
    info: 'Harvard University, in Cambridge, Massachusetts, is the oldest institution of higher learning in the United States.',
  },
  {
    coord: [-118.2851, 34.0224],
    name: 'University of Southern California',
    info: 'A leading private research university in Los Angeles, known for business, cinematic arts, engineering, and communication — and the closest of these campuses to home.',
  },
  {
    coord: [-118.1253, 34.1377],
    name: 'Caltech',
    info: 'The California Institute of Technology is a world leader in science and engineering education and research, with a small yet highly prestigious community.',
  },
  {
    coord: [-1.2544, 51.7548],
    name: 'University of Oxford',
    info: 'One of the world’s oldest universities, known for its rich history, academic rigor, and contributions to research.',
  },
  {
    coord: [0.1149, 52.2043],
    name: 'University of Cambridge',
    info: 'Established in 1209, renowned for its history of academic achievement and its place among the top universities in the world.',
  },
  {
    coord: [-87.6007, 41.7897],
    name: 'University of Chicago',
    info: 'A private research university known for its emphasis on intellectual inquiry and contributions to the social sciences and humanities.',
  },
  {
    coord: [-0.1749, 51.4988],
    name: 'Imperial College London',
    info: 'A public research university focused on science, engineering, medicine, and business, with a strong reputation for cutting-edge research.',
  },
  {
    coord: [8.5417, 47.3769],
    name: 'ETH Zurich',
    info: 'One of the top universities in Europe, particularly strong in science, technology, engineering, and mathematics.',
  },
  {
    coord: [-0.134, 51.5246],
    name: 'University College London',
    info: 'A leading multidisciplinary university in London, known for research across science, engineering, and the humanities.',
  },
  {
    coord: [103.7764, 1.2966],
    name: 'National University of Singapore',
    info: 'The top university in Singapore and one of the leading institutions in Asia, with a global reputation for research and teaching.',
  },
  {
    coord: [-75.1932, 39.9522],
    name: 'University of Pennsylvania',
    info: 'An Ivy League institution known for business, law, medicine, and education, as well as for its research impact.',
  },
  {
    coord: [-72.9223, 41.3163],
    name: 'Yale University',
    info: 'In New Haven, Connecticut — renowned for its law, arts, and humanities programs, and its historic campus.',
  },
  {
    coord: [-122.273, 37.8715],
    name: 'UC Berkeley',
    info: 'The flagship campus of the University of California system, known for rigorous academic programs and vibrant campus life.',
  },
  {
    coord: [-73.9626, 40.8075],
    name: 'Columbia University',
    info: 'An Ivy League institution in New York City known for its emphasis on research across a variety of disciplines.',
  },
  {
    coord: [-74.6514, 40.3431],
    name: 'Princeton University',
    info: 'Known for academic excellence, a small student body, and prestigious programs in the humanities and sciences.',
  },
  {
    coord: [-79.3957, 43.6629],
    name: 'University of Toronto',
    info: 'The leading university in Canada, recognized for its diverse programs and pioneering research.',
  },
  {
    coord: [116.326, 40.003],
    name: 'Tsinghua University',
    info: 'One of the most prestigious universities in China, known for science, technology, and engineering education.',
  },
  {
    coord: [116.4074, 39.9042],
    name: 'Peking University',
    info: 'A top research university in China with programs across the humanities, social sciences, and natural sciences.',
  },
  {
    coord: [139.7614, 35.7126],
    name: 'University of Tokyo',
    info: 'Japan’s leading university, known for academic excellence and cutting-edge research across multiple disciplines.',
  },
  {
    coord: [-3.1883, 55.9533],
    name: 'University of Edinburgh',
    info: 'A world-class institution in Scotland, known for research in the humanities, sciences, and medicine.',
  },
  {
    coord: [-83.7382, 42.278],
    name: 'University of Michigan',
    info: 'In Ann Arbor — known for research output, a large alumni network, and programs in law, business, and engineering.',
  },
  {
    coord: [6.5668, 46.5191],
    name: 'EPFL Lausanne',
    info: 'A research-intensive university in Switzerland, known for innovation in science, technology, and engineering.',
  },
  {
    coord: [149.1186, -35.2777],
    name: 'Australian National University',
    info: 'One of Australia’s leading universities, renowned for research, science, and public policy.',
  },
  {
    coord: [114.1371, 22.2833],
    name: 'University of Hong Kong',
    info: 'One of Asia’s top universities, with a reputation for research in medicine, law, and business.',
  },
];
