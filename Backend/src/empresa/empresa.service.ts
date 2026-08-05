import {Injectable, OnModuleInit, NotFoundException} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {Repository} from 'typeorm';
import {EmpresaConfig} from './esquemas/empresa.entity';
import {CuentaTransferencia} from './esquemas/cuenta-transferencia.entity';
import {UpdateEmpresaDto} from './esquemas/empresa.dto';

@Injectable()
export class EmpresaService implements OnModuleInit {
	constructor(
		@InjectRepository(EmpresaConfig)
		private readonly repo: Repository<EmpresaConfig>,
		@InjectRepository(CuentaTransferencia)
		private readonly cuentasRepo: Repository<CuentaTransferencia>,
	) {}

	async onModuleInit() {
		const count = await this.repo.count();
		if (count === 0) {
			await this.repo.save(
				this.repo.create({
					nit: '1026147348',
					razonSocial: 'Dfiruexpo Pizzería S.A.S',
					nombreComercial: 'Dfiru Pizzería',
				}),
			);
			console.log('🏢 EmpresaConfig initialized with default values.');
		}

		const countCuentas = await this.cuentasRepo.count();
		if (countCuentas === 0) {
			await this.cuentasRepo.save([
				this.cuentasRepo.create({nombre: 'Jeferson', activa: true}),
				this.cuentasRepo.create({nombre: 'Diana', activa: true}),
				this.cuentasRepo.create({nombre: 'Firu', activa: true}),
			]);
			console.log('💳 CuentasTransferencia initialized default accounts (Jeferson, Diana, Firu).');
		}
	}

	async getConfig() {
		return this.repo.findOne({where: {}}) || {};
	}

	async updateConfig(dto: UpdateEmpresaDto) {
		let config = await this.repo.findOne({where: {}});
		if (!config) {
			config = this.repo.create(dto);
		} else {
			Object.assign(config, dto);
		}
		return this.repo.save(config);
	}

	// ─── Cuentas Transferencia ──────────────────────────────────────────────────
	async getCuentasTransferencia(incluirInactivas = false) {
		if (incluirInactivas) {
			return this.cuentasRepo.find({orderBy: {id: 'ASC'}});
		}
		return this.cuentasRepo.find({where: {activa: true}, orderBy: {id: 'ASC'}});
	}

	async crearCuentaTransferencia(nombre: string) {
		const nueva = this.cuentasRepo.create({nombre: nombre.trim(), activa: true});
		return this.cuentasRepo.save(nueva);
	}

	async actualizarCuentaTransferencia(id: number, updates: {nombre?: string; activa?: boolean}) {
		const cuenta = await this.cuentasRepo.findOne({where: {id}});
		if (!cuenta) throw new NotFoundException(`Cuenta #${id} no encontrada`);
		if (updates.nombre !== undefined) cuenta.nombre = updates.nombre.trim();
		if (updates.activa !== undefined) cuenta.activa = updates.activa;
		return this.cuentasRepo.save(cuenta);
	}

	async eliminarCuentaTransferencia(id: number) {
		return this.cuentasRepo.delete(id);
	}
}
