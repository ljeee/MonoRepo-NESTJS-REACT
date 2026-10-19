import {Entity, PrimaryGeneratedColumn, Column, Index} from 'typeorm';
import {ColumnNumericTransformer as NumericTransformer} from '../../common/utils/numeric.transformer';

@Entity('facturas_pagos')
export class FacturasPagos {
	@PrimaryGeneratedColumn({name: 'pagos_id', type: 'bigint'})
	pagosId: number;

	@Column({name: 'total', type: 'numeric', nullable: true, transformer: new NumericTransformer()})
	total: number;

	@Column({name: 'nombre_gasto', type: 'text', nullable: true})
	nombreGasto: string;

	@Column({name: 'descripcion', type: 'text', nullable: true})
	descripcion: string;

	@Column({name: 'estado', type: 'text', nullable: true})
	estado: string;

	@Column({name: 'fecha_factura', type: 'date', nullable: true})
	@Index()
	fechaFactura: Date;

	@Column({name: 'metodo', type: 'text', nullable: true})
	metodo: string;

	/** Categoría contable (nomina, servicios, insumos…). 'general' = sin categoría (histórico). */
	@Column({name: 'categoria', type: 'text', nullable: true, default: 'general'})
	categoria: string;

	/** 'costo' | 'gasto'. NULL = sin clasificar (todo el histórico anterior a la clasificación). */
	@Column({name: 'tipo_gasto', type: 'text', nullable: true})
	tipoGasto: string | null;

	/**
	 * Cuenta de transferencia de la que SALIÓ el dinero (solo egresos pagados por QR). Es el espejo de
	 * `facturas_ventas.cuenta_transferencia_id` (por dónde ENTRÓ): con ambos se calcula el saldo por cuenta.
	 * NULL = sin asignar (egresos QR anteriores a este campo) o método que no es QR.
	 */
	@Column({name: 'cuenta_origen_id', type: 'int', nullable: true})
	@Index()
	cuentaOrigenId: number | null;

	@Column({name: 'denominaciones', type: 'jsonb', nullable: true})
	denominaciones: Record<string, number> | null;
}
