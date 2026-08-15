-- UnAcopio — catálogo de categorías de donación.
-- Idempotente: se puede volver a correr sin romper nada.

insert into categorias (slug, nombre, grupo, orden) values
  -- agua
  ('agua_embotellada',        'Agua embotellada',                 'agua',         10),
  ('agua_bidones',            'Agua en bidones o garrafas',       'agua',         11),
  ('tanques',                 'Tanques y recipientes de agua',    'agua',         12),
  -- alimentos
  ('no_perecederos',          'Alimentos no perecederos',         'alimentos',    20),
  ('enlatados',               'Enlatados',                        'alimentos',    21),
  ('granos',                  'Granos (arroz, fríjol, lenteja)',  'alimentos',    22),
  ('panela_azucar',           'Panela y azúcar',                  'alimentos',    23),
  ('aceite',                  'Aceite',                           'alimentos',    24),
  ('formula_infantil',        'Fórmula infantil y compotas',      'alimentos',    25),
  ('comida_preparada',        'Comida preparada',                 'alimentos',    26),
  -- aseo
  ('jabon',                   'Jabón y shampoo',                  'aseo',         30),
  ('papel_higienico',         'Papel higiénico',                  'aseo',         31),
  ('panales_bebe',            'Pañales de bebé',                  'aseo',         32),
  ('panales_adulto',          'Pañales de adulto',                'aseo',         33),
  ('toallas_higienicas',      'Toallas higiénicas',               'aseo',         34),
  ('cepillo_crema_dental',    'Cepillo y crema dental',           'aseo',         35),
  ('desinfectantes',          'Desinfectantes y detergente',      'aseo',         36),
  -- salud
  ('botiquin',                'Botiquín y curaciones',            'salud',        40),
  ('medicamentos_sellados',   'Medicamentos sellados y vigentes', 'salud',        41),
  ('suero_oral',              'Suero oral',                       'salud',        42),
  ('tapabocas',               'Tapabocas',                        'salud',        43),
  ('guantes',                 'Guantes desechables',              'salud',        44),
  -- albergue
  ('colchonetas',             'Colchonetas',                      'albergue',     50),
  ('cobijas',                 'Cobijas',                          'albergue',     51),
  ('sabanas',                 'Sábanas y almohadas',              'albergue',     52),
  ('carpas',                  'Carpas',                           'albergue',     53),
  ('plasticos_lona',          'Plásticos y lonas',                'albergue',     54),
  ('toldillos',               'Toldillos',                        'albergue',     55),
  -- ropa
  ('ropa_nueva',              'Ropa nueva',                       'ropa',         60),
  ('ropa_usada_buen_estado',  'Ropa usada en buen estado',        'ropa',         61),
  ('calzado',                 'Calzado',                          'ropa',         62),
  ('ropa_bebe',               'Ropa de bebé',                     'ropa',         63),
  -- hogar
  ('ollas_utensilios',        'Ollas y utensilios de cocina',     'hogar',        70),
  ('estufas_gas',             'Estufas y pipetas de gas',         'hogar',        71),
  ('velas_linternas',         'Velas y linternas',                'hogar',        72),
  ('pilas',                   'Pilas',                            'hogar',        73),
  ('baterias_celular',        'Baterías portátiles para celular', 'hogar',        74),
  -- construcción
  ('tejas',                   'Tejas',                            'construccion', 80),
  ('herramientas',            'Herramientas',                     'construccion', 81),
  ('palas_picas',             'Palas y picas',                    'construccion', 82),
  ('guantes_trabajo',         'Guantes de trabajo',               'construccion', 83),
  ('botas',                   'Botas',                            'construccion', 84),
  -- mascotas
  ('alimento_perro',          'Alimento para perro',              'mascotas',     90),
  ('alimento_gato',           'Alimento para gato',               'mascotas',     91),
  ('guacales',                'Guacales y correas',               'mascotas',     92),
  -- otros
  ('voluntarios',             'Voluntarios',                      'otros',       100),
  ('transporte_camiones',     'Transporte y camiones',            'otros',       101),
  ('equipos_pesados',         'Maquinaria y equipo pesado',       'otros',       102)
on conflict (slug) do update
  set nombre = excluded.nombre,
      grupo  = excluded.grupo,
      orden  = excluded.orden;
