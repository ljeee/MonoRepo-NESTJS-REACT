export class ColumnNumericTransformer {
	to(data: number): number {
		return data;
	}
	from(data: string | number): number {
        if (typeof data === 'number') {
            return data;
        }
		return parseFloat(data);
	}
}
