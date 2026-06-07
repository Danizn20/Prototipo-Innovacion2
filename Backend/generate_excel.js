import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const data = [
  // Abarrotes y Despensa
  ['Arroz grado 1 (1kg)', 'Abarrotes', 1100, 1600, 'Tucapel, Miraflores, Banquete'],
  ['Aceite vegetal / Maravilla (1L)', 'Abarrotes', 1600, 2200, 'Belmont, Chef, Natura'],
  ['Fideos Espagueti (400g)', 'Abarrotes', 650, 950, 'Carozzi, Lucchetti'],
  ['Fideos cortos Espirales (400g)', 'Abarrotes', 650, 950, 'Carozzi, Lucchetti'],
  ['Harina de trigo (1kg)', 'Abarrotes', 800, 1200, 'Selecta, Montblanc, Collico'],
  ['Azúcar granulada (1kg)', 'Abarrotes', 900, 1300, 'Iansa'],
  ['Sal de mesa (1kg)', 'Abarrotes', 350, 600, 'Lobos'],
  ['Salsa de tomates sachet (200g)', 'Abarrotes', 350, 550, 'Pomarola, Lucchetti, Malloa'],
  ['Lentejas envasadas (400g)', 'Abarrotes', 1200, 1800, 'Banquete, Tucapel'],
  ['Porotos envasados (400g)', 'Abarrotes', 1400, 2000, 'Banquete, Tucapel'],
  ['Garbanzos envasados (400g)', 'Abarrotes', 1500, 2100, 'Banquete, Tucapel'],
  ['Atún en tarro lomitos', 'Abarrotes', 1000, 1500, 'Robinson Crusoe, San José'],
  ['Jurel en tarro', 'Abarrotes', 1200, 1800, 'San José, Única'],
  ['Sopas instantáneas sobre', 'Abarrotes', 450, 700, 'Maggi, Naturezza'],
  ['Caldos en cubo (12 un)', 'Abarrotes', 800, 1200, 'Maggi, Gourmet'],
  ['Crema de espárragos sobre', 'Abarrotes', 550, 850, 'Maggi, Gourmet'],
  ['Pure de papas caja (250g)', 'Abarrotes', 1000, 1500, 'Maggi, Carozzi'],
  ['Salsa boloñesa lista', 'Abarrotes', 700, 1100, 'Carozzi, Tuco'],
  ['Crema de leche caja (200ml)', 'Abarrotes', 800, 1200, 'Nestlé, Colún'],
  ['Polvo de hornear', 'Abarrotes', 400, 650, 'Royal, Gourmet'],
  ['Levadura seca', 'Abarrotes', 350, 550, 'Collico, Lefersa'],
  ['Vinagre (blanco/vino)', 'Abarrotes', 700, 1100, 'Traverso'],
  ['Extracto de tomates', 'Abarrotes', 450, 750, 'Malloa, Centauro'],
  ['Sémola (400g)', 'Abarrotes', 650, 950, 'Selecta, Carozzi'],
  ['Avena entera (500g)', 'Abarrotes', 1000, 1500, 'Quaker'],

  // Lácteos y Huevos
  ['Leche líquida entera UHT (1L)', 'Lácteos', 850, 1200, 'Colún, Soprole'],
  ['Leche descremada UHT (1L)', 'Lácteos', 900, 1250, 'Colún, Soprole'],
  ['Leche en polvo (800g)', 'Lácteos', 5500, 7500, 'Nido, Svelty'],
  ['Yogurt batido (125g)', 'Lácteos', 220, 380, 'Soprole, Colún, Nestlé'],
  ['Yogurt con proteínas', 'Lácteos', 500, 750, 'Soprole, Nestlé'],
  ['Queso laminado (250g)', 'Lácteos', 2000, 2800, 'Colún, Soprole'],
  ['Quesillo fresco', 'Lácteos', 1800, 2500, 'Quillayes, Colún'],
  ['Queso rallado (40g)', 'Lácteos', 450, 700, 'Carozzi, Colún'],
  ['Mantequilla (250g)', 'Lácteos', 1800, 2500, 'Soprole, Colún'],
  ['Margarina (250g)', 'Lácteos', 800, 1200, 'Next, Sureña'],
  ['Manjar (500g)', 'Lácteos', 1400, 2100, 'Colún, Nestlé'],
  ['Huevos blancos (12 un)', 'Lácteos', 2200, 3200, 'Santa Marta, Castellana'],
  ['Flan / Jalea vaso', 'Lácteos', 250, 450, 'Soprole, Nestlé'],
  ['Probiótico Chamito (1 un)', 'Lácteos', 250, 400, 'Soprole, Nestlé'],
  ['Crema para batir', 'Lácteos', 900, 1300, 'Nestlé, Soprole'],

  // Panadería y Confitería
  ['Pan de molde blanco', 'Panadería', 1600, 2300, 'Ideal, Castaño'],
  ['Pan de molde integral', 'Panadería', 1800, 2600, 'Ideal, Fuchs'],
  ['Pan de hot dog', 'Panadería', 1300, 1900, 'Ideal, Castaño'],
  ['Pan de hamburguesa', 'Panadería', 1300, 1900, 'Ideal, Castaño'],
  ['Té corriente (100 un)', 'Desayuno', 2000, 3100, 'Supremo, Club'],
  ['Té ceilán (20 un)', 'Desayuno', 1400, 2000, 'Supremo, Lipton'],
  ['Café instantáneo tradicional (100g)', 'Desayuno', 2500, 3800, 'Nescafé, Cruzeiro'],
  ['Café liofilizado Gold (100g)', 'Desayuno', 3800, 5200, 'Nescafé Gold'],
  ['Mermelada frasco (250g)', 'Desayuno', 1100, 1600, 'Watt\'s, Vivo'],
  ['Cereal Hojuelas de maíz (500g)', 'Desayuno', 1800, 2600, 'Nestlé, Kellogg\'s'],
  ['Cereal Chocapic (500g)', 'Desayuno', 2600, 3600, 'Nestlé'],
  ['Galletas de agua/soda', 'Confitería', 600, 950, 'McKay, Costa'],
  ['Galletas Vino/Tuareg', 'Confitería', 600, 950, 'McKay'],
  ['Galletas rellenas Tritón', 'Confitería', 500, 800, 'McKay, Costa'],
  ['Barritas de cereal (6 un)', 'Confitería', 1500, 2200, 'Vivo, Quaker'],
  ['Chocolate en barra', 'Confitería', 1100, 1600, 'Sahne-Nuss, Costa'],
  ['Bombones / Alfajores', 'Confitería', 300, 600, 'Ambrosoli, Costa'],
  ['Caramelos / Gomitas', 'Confitería', 600, 900, 'Ambrosoli, Mogul'],
  ['Milo / Nesquik (400g)', 'Desayuno', 2500, 3600, 'Nestlé'],
  ['Endulzante líquido (270ml)', 'Desayuno', 1800, 2600, 'Daily, Iansa'],

  // Cecinas, Aderezos y Congelados
  ['Vienesas (5 un)', 'Congelados', 1000, 1600, 'PF, San Jorge'],
  ['Jamón de cerdo laminado (250g)', 'Fiambrería', 1800, 2600, 'PF, Receta del Abuelo'],
  ['Jamón de pavo laminado (250g)', 'Fiambrería', 2000, 2900, 'Sopraval, San Jorge'],
  ['Salame / Fuet', 'Fiambrería', 1500, 2200, 'Llanquihue, PF'],
  ['Paté ternera', 'Fiambrería', 500, 850, 'PF, Sadia'],
  ['Mayonesa tradicional (1kg)', 'Aderezos', 2600, 3800, 'Hellmann\'s, Kraft'],
  ['Mayonesa light (1kg)', 'Aderezos', 2800, 4000, 'Hellmann\'s'],
  ['Ketchup', 'Aderezos', 1100, 1600, 'Malloa, Hellmann\'s'],
  ['Mostaza', 'Aderezos', 700, 1100, 'JB, Traverso'],
  ['Papas fritas congeladas (1kg)', 'Congelados', 2200, 3200, 'Minuto Verde, McCain'],
  ['Primavera de verduras (congelada)', 'Congelados', 1500, 2200, 'Minuto Verde'],
  ['Choclo desgranado (congelado)', 'Congelados', 1600, 2400, 'Minuto Verde'],
  ['Hamburguesas vacuno (4 un)', 'Congelados', 2500, 3600, 'PF, La Crianza'],
  ['Nuggets de pollo (400g)', 'Congelados', 2200, 3200, 'Super Pollo, Sadia'],
  ['Helado de cassata (1L)', 'Congelados', 2500, 3600, 'Savory, Trendy'],

  // Bebidas y Snacks
  ['Bebida Cola (3L)', 'Bebidas', 2100, 3100, 'Coca-Cola, Pepsi'],
  ['Bebida fantasía (3L)', 'Bebidas', 1800, 2600, 'Bilz, Pap, Kem'],
  ['Bebida Lima-Limón (3L)', 'Bebidas', 1900, 2800, 'Sprite, Crush'],
  ['Jugo líquido caja (1L)', 'Bebidas', 900, 1300, 'Watt\'s, Andina'],
  ['Jugo en polvo sachet', 'Bebidas', 200, 350, 'Zuko, Livean'],
  ['Agua mineral (1.5L)', 'Bebidas', 700, 1100, 'Cachantún, Vital'],
  ['Agua saborizada (1.5L)', 'Bebidas', 900, 1300, 'Cachantún Mas'],
  ['Cerveza lager (pack 6)', 'Alcoholes', 3200, 4800, 'Cristal, Escudo'],
  ['Cerveza premium', 'Alcoholes', 4500, 6500, 'Royal Guard, Kross'],
  ['Pisco chileno 35° (1L)', 'Alcoholes', 5500, 7800, 'Mistral, Alto del Carmen'],
  ['Papas fritas snack', 'Snacks', 1300, 1900, 'Lays, Marco Polo'],
  ['Ramitas', 'Snacks', 1100, 1600, 'Evercrisp, Marco Polo'],
  ['Maní salado', 'Snacks', 1000, 1500, 'Marco Polo'],

  // Limpieza y Hogar
  ['Papel higiénico (4 rollos)', 'Limpieza', 2200, 3200, 'Confort, Elite'],
  ['Toalla Nova absorbente', 'Limpieza', 1400, 2100, 'Nova, Elite'],
  ['Servilletas de papel', 'Limpieza', 700, 1100, 'Favorita, Elite'],
  ['Detergente líquido (3L)', 'Limpieza', 5500, 8500, 'Omo, Ariel'],
  ['Detergente en polvo (3kg)', 'Limpieza', 5000, 7800, 'Rinso, Omo'],
  ['Suavizante de ropa (1L)', 'Limpieza', 1800, 2600, 'Soft, Fuzol'],
  ['Lavaloza líquido (500ml)', 'Limpieza', 1100, 1600, 'Quix, Magistral'],
  ['Cloro líquido (1L)', 'Limpieza', 700, 1100, 'Clorox'],
  ['Limpiador de pisos (900ml)', 'Limpieza', 1100, 1600, 'Poett, Cif'],
  ['Limpiavidrios', 'Limpieza', 1300, 1900, 'Glassex, Cif'],
  ['Insecticida en aerosol', 'Limpieza', 2500, 3600, 'Raid, Baygon'],
  ['Bolsas de basura (10 un)', 'Limpieza', 900, 1400, 'Basuritas, Virutex']
];

const rows = data.map((item, index) => {
  const [name, category, oldCost, marketValue, notes] = item;
  const sku = `REF-${String(index + 1).padStart(3, '0')}`;
  
  // Formula: Valor de compra para el minimarket = mercado - 20%
  const cost = marketValue * 0.8;
  // Valor de venta = compra + 200, redondeado a la decena más cercana
  const rawSalePrice = cost + 200;
  const salePrice = Math.round(rawSalePrice / 10) * 10;

  let supplier = 'Proveedor General';
  if (category === 'Abarrotes') supplier = 'Distribuidora Abarrotes del Sur';
  else if (category === 'Lácteos') supplier = 'Soprole / Colún Directo';
  else if (category === 'Panadería') supplier = 'Castaño Comercial';
  else if (category === 'Desayuno') supplier = 'Nestlé Chile S.A.';
  else if (category === 'Congelados') supplier = 'Minuto Verde Distribución';
  else if (category === 'Fiambrería') supplier = 'Cecinas San Jorge';
  else if (category === 'Bebidas') supplier = 'Embotelladora Andina';
  else if (category === 'Alcoholes') supplier = 'CCU / Cervecería Chile';
  else if (category === 'Cuidado Personal') supplier = 'Unilever Chile';
  else if (category === 'Limpieza') supplier = 'Clorox / Virutex';
  else if (category === 'Snacks') supplier = 'Evercrisp Snack Productos';

  return {
    name,
    supplier,
    marketValue,
    sku,
    stock: 20,
    category,
    status: 'Activo',
    cost,
    salePrice,
    notes: 'Marcas comunes: ' + notes
  };
});

const workbook = XLSX.utils.book_new();
const worksheet = XLSX.utils.json_to_sheet(rows);

XLSX.utils.book_append_sheet(workbook, worksheet, 'Productos');

const outputPath = path.join(process.cwd(), '..', 'referencia_precios_chile.xlsx');
XLSX.writeFile(workbook, outputPath);

console.log('Archivo Excel generado en:', outputPath);
