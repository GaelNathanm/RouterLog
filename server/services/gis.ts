// GIS Database and Services for Brazilian Logistics Autocomplete, Validation, and Directions
export const GIS_ADDRESS_DATABASE = [
  {
    address: 'Rua Israel Pinheiro, 2500 - Centro, Governador Valadares, MG, CEP 35010-130',
    street: 'Rua Israel Pinheiro',
    number: '2500',
    neighborhood: 'Centro',
    city: 'Governador Valadares',
    state: 'MG',
    cep: '35010-130',
    lat: -18.852,
    lng: -41.952,
    restrictions: { maxHeight: 4.5, maxWeight: 15 },
    tolls: []
  },
  {
    address: 'Av. Minas Gerais, 980 - Nossa Senhora das Graças, Governador Valadares, MG, CEP 35012-320',
    street: 'Av. Minas Gerais',
    number: '980',
    neighborhood: 'Nossa Senhora das Graças',
    city: 'Governador Valadares',
    state: 'MG',
    cep: '35012-320',
    lat: -18.858,
    lng: -41.939,
    restrictions: { maxHeight: 4.0, maxWeight: 10 }, // bridge clearance warning
    tolls: []
  },
  {
    address: 'Rua Quintino Bocaiúva, 450 - Esplanada, Governador Valadares, MG, CEP 35020-430',
    street: 'Rua Quintino Bocaiúva',
    number: '450',
    neighborhood: 'Esplanada',
    city: 'Governador Valadares',
    state: 'MG',
    cep: '35020-430',
    lat: -18.865,
    lng: -41.947,
    restrictions: { maxHeight: 4.8, maxWeight: 20 },
    tolls: []
  },
  {
    address: 'Av. Brasil, 4200 - Centro, Governador Valadares, MG, CEP 35020-010',
    street: 'Av. Brasil',
    number: '4200',
    neighborhood: 'Centro',
    city: 'Governador Valadares',
    state: 'MG',
    cep: '35020-010',
    lat: -18.855,
    lng: -41.942,
    restrictions: { maxHeight: 4.5, maxWeight: 12 },
    tolls: []
  },
  {
    address: 'Rua Sete de Setembro, 320 - Esplanada, Governador Valadares, MG, CEP 35020-120',
    street: 'Rua Sete de Setembro',
    number: '320',
    neighborhood: 'Esplanada',
    city: 'Governador Valadares',
    state: 'MG',
    cep: '35020-120',
    lat: -18.862,
    lng: -41.948,
    restrictions: { maxHeight: 4.5, maxWeight: 15 },
    tolls: []
  },
  {
    address: 'Av. JK, 1100 - Vila Isa, Governador Valadares, MG, CEP 35044-000',
    street: 'Av. JK',
    number: '1100',
    neighborhood: 'Vila Isa',
    city: 'Governador Valadares',
    state: 'MG',
    cep: '35044-000',
    lat: -18.882,
    lng: -41.972,
    restrictions: { maxHeight: 3.8, maxWeight: 8 }, // restrict large trucks
    tolls: [{ name: 'Pedágio Ponte do Rio Doce', cost: 7.20 }]
  },
  {
    address: 'Av. Afonso Pena, 1500 - Centro, Belo Horizonte, MG, CEP 30130-003',
    street: 'Av. Afonso Pena',
    number: '1500',
    neighborhood: 'Centro',
    city: 'Belo Horizonte',
    state: 'MG',
    cep: '30130-003',
    lat: -19.922,
    lng: -43.935,
    restrictions: { maxHeight: 4.5, maxWeight: 15 },
    tolls: []
  },
  {
    address: 'Av. do Contorno, 4000 - Savassi, Belo Horizonte, MG, CEP 30110-017',
    street: 'Av. do Contorno',
    number: '4000',
    neighborhood: 'Savassi',
    city: 'Belo Horizonte',
    state: 'MG',
    cep: '30110-017',
    lat: -19.940,
    lng: -43.925,
    restrictions: { maxHeight: 4.2, maxWeight: 12 },
    tolls: []
  },
  {
    address: 'Av. Amazonas, 3200 - Prado, Belo Horizonte, MG, CEP 30411-000',
    street: 'Av. Amazonas',
    number: '3200',
    neighborhood: 'Prado',
    city: 'Belo Horizonte',
    state: 'MG',
    cep: '30411-000',
    lat: -19.928,
    lng: -43.965,
    restrictions: { maxHeight: 4.5, maxWeight: 15 },
    tolls: [{ name: 'Pedágio Via Expressa BH', cost: 5.50 }]
  }
];

// Helper to calculate haversine distance in km
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}
