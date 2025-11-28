import {Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn} from 'typeorm';
import {FacturasVentas} from '../../facturas-ventas/esquemas/facturas-ventas.entity';
import {OrdenesProductos} from '../../ordenes-productos/esquemas/ordenes-productos.entity';
import {Domicilios} from '../../domicilios/esquemas/domicilios.entity';

@Entity('ordenes')
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
	fechaOrden: Date;

	@ManyToOne(() => FacturasVentas, (factura) => factura.ordenes, {nullable: true})
    @JoinColumn({name: 'factura_id'})
	factura: FacturasVentas;

	@OneToMany(() => OrdenesProductos, (op) => op.orden)
	productos: OrdenesProductos[];

	@OneToMany(() => Domicilios, (domicilio) => domicilio.orden)
	domicilios: Domicilios[];
}
