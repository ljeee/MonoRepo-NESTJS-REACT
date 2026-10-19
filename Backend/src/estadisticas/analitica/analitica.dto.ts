import {ApiPropertyOptional, ApiProperty} from '@nestjs/swagger';
import {Transform} from 'class-transformer';
import {ArrayMaxSize, IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min} from 'class-validator';
import {CATEGORIAS_PRODUCTO, CategoriaProducto} from '../../common/utils/catalogo.util';

export const TIPOS_PEDIDO = ['mesa', 'llevar', 'domicilio'] as const;
export const METODOS_PAGO_FILTRO = ['efectivo', 'transferencia', 'mixto', 'sin_metodo', 'otro'] as const;
export const ESTADOS_PAGO = ['cobrada', 'parcial', 'pendiente'] as const;
export const CANALES = ['pos', 'web'] as const;
export const TAMANOS = ['pequena', 'mediana', 'grande'] as const;

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Los transforms leen el valor CRUDO del query (`obj[key]`), no `value`: con
 * enableImplicitConversion (main.ts) class-transformer convierte antes según el tipo
 * declarado, y Boolean('false') === true.
 */
type ArgsTransform = {value: unknown; key: string; obj: Record<string, unknown>};
const crudo = ({value, key, obj}: ArgsTransform): unknown => (obj && key in obj ? obj[key] : value);

/** "a,b,c" | ["a","b"] → ["a","b","c"] (sin vacíos). */
function aLista(args: ArgsTransform): string[] | undefined {
	const value = crudo(args);
	if (value == null || value === '') return undefined;
	const crudos = Array.isArray(value) ? value : String(value as string | number).split(',');
	const lista = crudos.map((v) => String(v).trim()).filter(Boolean);
	return lista.length ? lista : undefined;
}

function aListaNumeros(args: ArgsTransform): number[] | undefined {
	const lista = aLista(args)
		?.map(Number)
		.filter((n) => Number.isInteger(n));
	return lista?.length ? lista : undefined;
}

function aNumero(args: ArgsTransform): number | undefined {
	const value = crudo(args);
	return value === '' || value == null ? undefined : Number(value);
}

function aBooleano(args: ArgsTransform): boolean | undefined {
	const value = crudo(args);
	if (value == null || value === '') return undefined;
	if (typeof value === 'boolean') return value;
	return ['1', 'true', 'si', 'sí'].includes(String(value as string | number).toLowerCase());
}

/**
 * Filtros comunes a todos los endpoints de /estadisticas/analitica. Las listas llegan
 * separadas por comas (?tipoPedido=mesa,domicilio). Fechas 'YYYY-MM-DD' en hora de Bogotá.
 */
export class FiltrosAnaliticaDto {
	@ApiProperty({example: '2026-05-01'})
	@Matches(FECHA_RE, {message: 'from debe ser YYYY-MM-DD'})
	from: string;

	@ApiProperty({example: '2026-05-31'})
	@Matches(FECHA_RE, {message: 'to debe ser YYYY-MM-DD'})
	to: string;

	@ApiPropertyOptional({description: 'Incluir el período anterior de igual duración'})
	@IsOptional()
	@Transform(aBooleano)
	@IsBoolean()
	comparar?: boolean;

	@ApiPropertyOptional({enum: TIPOS_PEDIDO, isArray: true})
	@IsOptional()
	@Transform(aLista)
	@IsIn(TIPOS_PEDIDO, {each: true})
	tipoPedido?: (typeof TIPOS_PEDIDO)[number][];

	@ApiPropertyOptional({enum: METODOS_PAGO_FILTRO, isArray: true})
	@IsOptional()
	@Transform(aLista)
	@IsIn(METODOS_PAGO_FILTRO, {each: true})
	metodoPago?: (typeof METODOS_PAGO_FILTRO)[number][];

	@ApiPropertyOptional({enum: ESTADOS_PAGO, isArray: true})
	@IsOptional()
	@Transform(aLista)
	@IsIn(ESTADOS_PAGO, {each: true})
	estadoPago?: (typeof ESTADOS_PAGO)[number][];

	@ApiPropertyOptional({enum: CANALES, isArray: true})
	@IsOptional()
	@Transform(aLista)
	@IsIn(CANALES, {each: true})
	canal?: (typeof CANALES)[number][];

	@ApiPropertyOptional({description: 'Id del usuario que creó la orden'})
	@IsOptional()
	@IsString()
	@MaxLength(100)
	usuario?: string;

	@ApiPropertyOptional({enum: CATEGORIAS_PRODUCTO, isArray: true})
	@IsOptional()
	@Transform(aLista)
	@IsIn(CATEGORIAS_PRODUCTO, {each: true})
	categoria?: CategoriaProducto[];

	@ApiPropertyOptional({type: [Number]})
	@IsOptional()
	@Transform(aListaNumeros)
	@IsInt({each: true})
	productoId?: number[];

	@ApiPropertyOptional({type: [Number]})
	@IsOptional()
	@Transform(aListaNumeros)
	@IsInt({each: true})
	varianteId?: number[];

	@ApiPropertyOptional({enum: TAMANOS, isArray: true})
	@IsOptional()
	@Transform(aLista)
	@IsIn(TAMANOS, {each: true})
	tamano?: (typeof TAMANOS)[number][];

	@ApiPropertyOptional({type: [Number]})
	@IsOptional()
	@Transform(aListaNumeros)
	@IsInt({each: true})
	saborId?: number[];

	/** Grupo de sabores del producto vendido (Pizza, Calzone…). */
	@ApiPropertyOptional({type: [Number]})
	@IsOptional()
	@Transform(aListaNumeros)
	@IsInt({each: true})
	saborGrupoId?: number[];

	@ApiPropertyOptional({type: [Number], description: 'Día ISO: 1 = lunes … 7 = domingo'})
	@IsOptional()
	@Transform(aListaNumeros)
	@IsInt({each: true})
	@Min(1, {each: true})
	@Max(7, {each: true})
	diaSemana?: number[];

	@ApiPropertyOptional({minimum: 0, maximum: 23})
	@IsOptional()
	@Transform(aNumero)
	@IsInt()
	@Min(0)
	@Max(23)
	horaDesde?: number;

	@ApiPropertyOptional({minimum: 0, maximum: 23})
	@IsOptional()
	@Transform(aNumero)
	@IsInt()
	@Min(0)
	@Max(23)
	horaHasta?: number;

	@ApiPropertyOptional({description: 'Teléfono del domiciliario'})
	@IsOptional()
	@IsString()
	@MaxLength(20)
	domiciliario?: string;

	@ApiPropertyOptional({description: 'Teléfono del cliente'})
	@IsOptional()
	@IsString()
	@MaxLength(20)
	cliente?: string;

	@ApiPropertyOptional({description: 'Solo líneas con (true) o sin (false) precio manual'})
	@IsOptional()
	@Transform(aBooleano)
	@IsBoolean()
	precioManual?: boolean;
}

export const AGRUPACIONES_PRODUCTO = ['producto', 'variante', 'tamano', 'categoria'] as const;
export const ORDENES_PRODUCTO = ['unidades', 'ingresos', 'veces'] as const;

export class ProductosAnaliticaDto extends FiltrosAnaliticaDto {
	@ApiPropertyOptional({enum: AGRUPACIONES_PRODUCTO, default: 'producto'})
	@IsOptional()
	@IsIn(AGRUPACIONES_PRODUCTO)
	agrupar?: (typeof AGRUPACIONES_PRODUCTO)[number];

	@ApiPropertyOptional({enum: ORDENES_PRODUCTO, default: 'unidades'})
	@IsOptional()
	@IsIn(ORDENES_PRODUCTO)
	orden?: (typeof ORDENES_PRODUCTO)[number];

	@ApiPropertyOptional({default: 50, maximum: 500})
	@IsOptional()
	@Transform(aNumero)
	@IsInt()
	@Min(1)
	@Max(500)
	limit?: number;

	@ApiPropertyOptional({default: 0})
	@IsOptional()
	@Transform(aNumero)
	@IsInt()
	@Min(0)
	offset?: number;

	@ApiPropertyOptional({description: 'Buscar por nombre'})
	@IsOptional()
	@IsString()
	@MaxLength(100)
	q?: string;
}

export const METRICAS_SABOR = ['apariciones', 'porciones'] as const;

export class SaboresAnaliticaDto extends FiltrosAnaliticaDto {
	@ApiPropertyOptional({
		enum: METRICAS_SABOR,
		default: 'apariciones',
		description: 'apariciones = pizzas que incluyen el sabor; porciones = equivalente en pizzas (mitad = 0.5)',
	})
	@IsOptional()
	@IsIn(METRICAS_SABOR)
	metrica?: (typeof METRICAS_SABOR)[number];

	@ApiPropertyOptional({default: 50, maximum: 200})
	@IsOptional()
	@Transform(aNumero)
	@IsInt()
	@Min(1)
	@Max(200)
	limit?: number;
}

export const GRANULARIDADES = ['dia', 'semana', 'mes'] as const;

export class SerieAnaliticaDto extends FiltrosAnaliticaDto {
	@ApiPropertyOptional({enum: GRANULARIDADES, description: 'Por defecto según la duración del rango'})
	@IsOptional()
	@IsIn(GRANULARIDADES)
	granularidad?: (typeof GRANULARIDADES)[number];
}

export class LimiteAnaliticaDto extends FiltrosAnaliticaDto {
	@ApiPropertyOptional({default: 20, maximum: 200})
	@IsOptional()
	@Transform(aNumero)
	@IsInt()
	@Min(1)
	@Max(200)
	limit?: number;

	@ApiPropertyOptional({description: 'Solo estos clientes (teléfonos separados por coma, máx. 200)', example: '3001234567,3109876543'})
	@IsOptional()
	@Transform(aLista)
	@ArrayMaxSize(200)
	@IsString({each: true})
	telefonos?: string[];
}

export const ORDENES_CLIENTE = ['gasto', 'facturas', 'ticket', 'ultimaVisita'] as const;

/** Clientes del período, paginados en el servidor (antes: el top 200 por gasto y el resto ordenado en el cliente). */
export class ClientesAnaliticaDto extends LimiteAnaliticaDto {
	@ApiPropertyOptional({default: 0})
	@IsOptional()
	@Transform(aNumero)
	@IsInt()
	@Min(0)
	offset?: number;

	@ApiPropertyOptional({enum: ORDENES_CLIENTE, default: 'gasto'})
	@IsOptional()
	@IsIn(ORDENES_CLIENTE)
	orden?: (typeof ORDENES_CLIENTE)[number];
}

/** Solo rango de fechas (resumen general de dinero, sin filtros de analítica). */
export class RangoFechasDto {
	@ApiProperty({example: '2026-05-01'})
	@Matches(FECHA_RE, {message: 'from debe ser YYYY-MM-DD'})
	from: string;

	@ApiProperty({example: '2026-05-31'})
	@Matches(FECHA_RE, {message: 'to debe ser YYYY-MM-DD'})
	to: string;
}
