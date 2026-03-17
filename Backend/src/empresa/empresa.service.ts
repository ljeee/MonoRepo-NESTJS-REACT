import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmpresaConfig } from './esquemas/empresa.entity';
import { UpdateEmpresaDto } from './esquemas/empresa.dto';

@Injectable()
export class EmpresaService implements OnModuleInit {
    constructor(
        @InjectRepository(EmpresaConfig)
        private readonly repo: Repository<EmpresaConfig>,
    ) {}

    async onModuleInit() {
        const count = await this.repo.count();
        if (count === 0) {
            await this.repo.save(this.repo.create({
                nit: '1026147348',
                razonSocial: 'Dfiruexpo Pizzería S.A.S',
                nombreComercial: 'Dfiru Pizzería',
            }));
            console.log('🏢 EmpresaConfig initialized with default values.');
        }
    }

    async getConfig() {
        return this.repo.findOne({ where: {} }) || {};
    }

    async updateConfig(dto: UpdateEmpresaDto) {
        let config = await this.repo.findOne({ where: {} });
        if (!config) {
            config = this.repo.create(dto);
        } else {
            Object.assign(config, dto);
        }
        return this.repo.save(config);
    }
}
