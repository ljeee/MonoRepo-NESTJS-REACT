import 'reflect-metadata';
import {DataSource} from 'typeorm';
import {AppDataSource} from '../../data-source';
import {User} from '../../auth/esquemas/user.entity';
import {Role} from '../../auth/roles.enum';
import * as bcrypt from 'bcrypt';

type UserSeed = {
	username: string;
	password: string;
	name: string;
	roles: Role[];
};

export async function seedUsers() {
	const dataSource = await AppDataSource.initialize();
	const userRepository = dataSource.getRepository(User);

	try {
		console.log('🚀 Seeding users...');

		const users: UserSeed[] = [
			{
				username: 'admin',
				password: 'Admin123!',
				name: 'Admin',
				roles: [Role.Admin],
			},
			{
				username: 'cocina',
				password: 'Cocina123!',
				name: 'Cocina',
				roles: [Role.Cocina],
			},
			{
				username: 'cajero',
				password: 'Cajero123!',
				name: 'Caja',
				roles: [Role.Mesero], // Mesero role is assumed to handle cajero duties
			},
		];

		for (const userData of users) {
			const existing = await userRepository.findOne({where: {username: userData.username}});
			if (existing) {
				console.log(`ℹ️  User ${userData.username} already exists, skipping.`);
				continue;
			}

			const hash = await bcrypt.hash(userData.password, 10);
			const user = userRepository.create({
				username: userData.username,
				name: userData.name,
				passwordHash: hash,
				roles: userData.roles,
			});
			await userRepository.save(user);
			console.log(`✅ User created: ${userData.username}`);
		}

		console.log('✅ Users seeded successfully!');
	} catch (error) {
		console.error('❌ Error seeding users:', error);
		throw error;
	} finally {
		await dataSource.destroy();
	}
}

// If run directly
if (require.main === module) {
	seedUsers().catch(() => process.exit(1));
}