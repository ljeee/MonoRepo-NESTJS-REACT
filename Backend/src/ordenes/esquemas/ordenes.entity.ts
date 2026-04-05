import {Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn, Index, UpdateDateColumn} from 'typeorm';
import {FacturasVentas} from '../../facturas-ventas/esquemas/facturas-ventas.entity';
import {OrdenesProductos} from '../../ordenes-productos/esquemas/ordenes-productos.entity';
import {Domicilios} from '../../domicilios/esquemas/domicilios.entity';

@Entity('ordenes')
@Index(['estadoOrden', 'fechaOrden'])
export class Ordenes {
	@PrimaryGeneratedColumn({name: 'orden_id'})
	ordenId: number;

	@Column({name: 'factura_id', type: 'integer', nullable: true})
	facturaId: number;

	@Column({name: 'tipo_pedido', type: 'text', default: () => "'mesa'"})
	tipoPedido: string;

	@Column({name: 'estado_orden', type: 'text', default: () => "'pendiente'"})
	estadoOrden: string;

	@Column({name: 'fecha_orden', type: 'timestamptz', default: () => 'now()'})
	@Index()
	fechaOrden: Date;

	@Column({name: 'observaciones', type: 'text', nullable: true})
	observaciones: string;

	@Column({name: 'usuario_cancelacion_id', type: 'text', nullable: true})
	usuarioCancelacionId: string;

	@Column({name: 'fecha_cancelacion', type: 'timestamptz', nullable: true})
	fechaCancelacion: Date;

	@ManyToOne(() => FacturasVentas, (factura) => factura.ordenes, {nullable: true, onDelete: 'CASCADE'})
    @JoinColumn({name: 'factura_id'})
	factura: FacturasVentas;

	@OneToMany(() => OrdenesProductos, (op) => op.orden)
	productos: OrdenesProductos[];

	@OneToMany(() => Domicilios, (domicilio) => domicilio.orden)
	domicilios: Domicilios[];

	@UpdateDateColumn({name: 'updated_at', type: 'timestamptz'})
	updatedAt: Date;
}
