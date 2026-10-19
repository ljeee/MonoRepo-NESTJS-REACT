import type {DesgloseTransferencia} from '../../domain/ventas';
import type {CategoriaProducto, TamanoPizza} from '../../utils/catalogo.util';
import type {ReglasGrupo} from '../../../ordenes/utils/recargos-sabores';

/** Lo que el generador necesita saber del catálogo real (se lee de la BD; en las pruebas se arma a mano). */
export interface VarianteCat {
	varianteId: number;
	productoId: number;
	producto: string;
	nombre: string;
	precio: number;
	/** Tamaño explícito de la variante (`producto_variantes.tamano`); null = se deduce del nombre. */
	tamano: string | null;
	categoria: CategoriaProducto;
	/** Grupo de sabores del producto (null = el producto no lleva sabores). */
	grupoId: number | null;
}

export interface GrupoCat extends ReglasGrupo {
	id: number;
	nombre: string;
	varianteEsSabor: boolean;
	maxSabores: number;
}

export interface SaborCat {
	saborId: number;
	nombre: string;
	grupoId: number | null;
	recargoPequena: number;
	recargoMediana: number;
	recargoGrande: number;
}

export interface Catalogo {
	variantes: VarianteCat[];
	grupos: GrupoCat[];
	sabores: SaborCat[];
	/** Domiciliarios registrados (telefono = username del usuario domiciliario). */
	domiciliarios: {telefono: string; nombre: string}[];
}

export interface ClienteDemo {
	telefono: string;
	nombre: string;
	correo: string | null;
	/** Con contraseña (123456) para probar el login de ClientWeb. */
	conPassword: boolean;
	direcciones: {direccion: string; referencia: string | null; costoDomicilio: number}[];
}

export interface LineaDemo {
	/** Texto de la línea tal como lo leen KDS y recibos ("Pizza - Grande (Paisa + Carnes)"). */
	producto: string;
	cantidad: number;
	precioUnitario: number;
	varianteId: number;
	productoId: number;
	productoBase: string;
	varianteNombre: string;
	tamano: TamanoPizza | null;
	categoria: CategoriaProducto;
	precioLista: number;
	precioManual: boolean;
	sabores: {saborId: number | null; nombre: string; posicion: number; fraccion: number}[];
}

export type EstadoFacturaDemo = 'pagado' | 'pendiente' | 'parcial' | 'cancelado';

export interface AbonoDemo {
	metodo: 'efectivo' | 'transferencia';
	monto: number;
	/** Nombre de la cuenta (solo transferencia). */
	cuenta: string | null;
	fecha: Date;
}

export interface FacturaDemo {
	/** Llave única `demo-N`: marca de las filas de demostración (para reiniciar sin tocar datos reales). */
	clave: string;
	clienteNombre: string;
	telefonoCliente: string | null;
	descripcion: string;
	fecha: Date;
	estado: EstadoFacturaDemo;
	metodo: 'efectivo' | 'transferencia' | 'efectivo_transferencia' | null;
	pagoEfectivo: number | null;
	pagoTransferencia: number | null;
	total: number;
	montoPagado: number | null;
	fechaCobro: Date | null;
	/** Cuenta de la factura (nombre) y reparto por cuenta cuando hubo abonos QR a varias. */
	cuenta: string | null;
	desglose: (Omit<DesgloseTransferencia, 'cuentaId'> & {cuenta: string})[] | null;
	/** Cobros en efectivo que entran a la caja (uno por cobro o abono). */
	entradasCaja: {monto: number; fecha: Date; metodo: string; pagoTransferencia: number | null}[];
	orden: {
		tipoPedido: 'mesa' | 'llevar' | 'domicilio';
		estadoOrden: 'pendiente' | 'en preparación' | 'completada' | 'cancelado';
		fecha: Date;
		canal: 'pos' | 'web' | 'whatsapp';
		observaciones: string | null;
		usuarioCreacionId: string | null;
		lineas: LineaDemo[];
	};
	domicilio: {
		telefono: string;
		direccion: string;
		referencia: string | null;
		costo: number;
		telefonoDomiciliario: string | null;
		estado: 'pendiente' | 'entregado' | 'cancelado';
	} | null;
}

export interface GastoDemo {
	nombre: string;
	descripcion: string;
	total: number;
	fecha: string; // yyyy-mm-dd Bogotá
	estado: 'pagado' | 'pendiente';
	metodo: 'qr' | 'efectivo_no_caja';
	categoria: string;
	tipoGasto: 'costo' | 'gasto' | null;
	/** Cuenta de la que salió (solo QR). */
	cuentaOrigen: string | null;
}

export interface AperturaDemo {
	fecha: string; // yyyy-mm-dd Bogotá
	instante: Date;
	total: number;
	denominaciones: Record<string, number>;
}

export interface StockDemo {
	tipo: 'caja' | 'bebida';
	nombre: string;
	categoria: string;
	cantidad: number;
	alertaMinimo: number;
	nivelObjetivo: number;
	/** `origen` único del ítem. Las bebidas usan `variante:<id>` (el mismo esquema que el servicio de inventario). */
	origen: string;
	/** Variante que consume este ítem (regla de consumo). Las cajas listan varias. */
	variantes: {varianteId: number; soloParaLlevar: boolean}[];
}

export interface UbicacionDemo {
	telefono: string;
	latitud: number;
	longitud: number;
	/** Minutos atrás en que reportó por última vez. */
	haceMinutos: number;
}

export interface DatasetDemo {
	cuentas: string[];
	clientes: ClienteDemo[];
	facturas: FacturaDemo[];
	gastos: GastoDemo[];
	aperturas: AperturaDemo[];
	stock: StockDemo[];
	ubicaciones: UbicacionDemo[];
}
