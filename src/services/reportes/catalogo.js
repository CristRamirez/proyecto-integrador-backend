const CATALOGO = [
  {
    id: 'balance',
    codigo: 'RP-01',
    titulo: 'Balance general',
    descripcion: 'Ingresos cobrados contra egresos del rango elegido.',
    endpoint: '/api/reportes/balance',
    disponible: true,
  },
  {
    id: 'cuenta-corriente',
    codigo: 'RP-02',
    titulo: 'Cuenta corriente',
    descripcion: 'Estado de las cuotas del rango elegido: facturado, cobrado y pendiente.',
    endpoint: '/api/reportes/cuenta-corriente',
    disponible: false,
  },
  {
    id: 'clasificacion',
    codigo: 'RP-03',
    titulo: 'Clasificación de internos',
    descripcion: 'Internos activos por situación judicial y por cobertura.',
    endpoint: '/api/reportes/clasificacion',
    disponible: false,
  },
  {
    id: 'medios-pago',
    codigo: 'RP-04',
    titulo: 'Ingresos por medio de pago',
    descripcion: 'Lo cobrado por cada medio de pago en el rango elegido.',
    endpoint: '/api/reportes/medios-pago',
    disponible: true,
  },
  {
    id: 'egresos',
    codigo: 'RP-05',
    titulo: 'Egresos por medio y categoría',
    descripcion: 'Egresos del rango elegido por medio de pago y por categoría.',
    endpoint: '/api/reportes/egresos',
    disponible: false,
  },
  {
    id: 'obras-sociales',
    codigo: 'RP-06',
    titulo: 'Balance de obra social',
    descripcion: 'Cobros con medio obra social por obra social pagadora.',
    endpoint: '/api/reportes/obras-sociales',
    disponible: false,
  },
  {
    id: 'egresos-internos',
    codigo: 'RP-07',
    titulo: 'Recuperados y abandonos',
    descripcion: 'Egresos de internos del rango elegido por tipo de egreso.',
    endpoint: '/api/reportes/egresos-internos',
    disponible: false,
  },
  {
    id: 'deuda',
    codigo: 'RP-08',
    titulo: 'Deuda detallada',
    descripcion: 'Internos con saldo pendiente, sus cuotas adeudadas y la antigüedad de la deuda.',
    endpoint: '/api/reportes/deuda',
    disponible: false,
  },
];

function listar() {
  return CATALOGO;
}

function buscar(id) {
  return CATALOGO.find((reporte) => reporte.id === id) || null;
}

module.exports = { listar, buscar };
