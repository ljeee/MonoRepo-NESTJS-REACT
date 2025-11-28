import {Entity, PrimaryGeneratedColumn, Column} from 'typeorm';

@Entity('facturas_pagos')
export class FacturasPagos {
	@PrimaryGeneratedColumn({name: 'pagos_id', type: 'bigint'})
	pagosId: number;

	@Column({name: 'total', type: 'numeric', nullable: true})
	total: number;

	@Column({name: 'nombre_gasto', type: 'text', nullable: true})
	nombreGasto: string;

	@Column({name: 'descripcion', type: 'text', nullable: true})
	descripcion: string;

	@Column({name: 'estado', type: 'text', nullable: true})
	estado: string;

	@Column({name: 'fecha_factura', type: 'date', nullable: true})
	fechaFactura: Date;

	@Column({name: 'metodo', type: 'text', nullable: true})
	metodo: string;
}
