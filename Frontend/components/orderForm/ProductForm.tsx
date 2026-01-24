import { Picker } from '@react-native-picker/picker';
import React from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { colors } from '../../styles/theme';
import { productFormStyles as styles } from '../../styles/ProductForm.styles';
import { useBreakpoint } from '../../styles/responsive';

const pizzaTamanos = [
  { label: 'Pequeña', value: 'Pequena' },
  { label: 'Mediana', value: 'Mediana' },
  { label: 'Grande', value: 'Grande' },
];

type Product = {
  tipo: string;
  tamano?: string;
  sabor1?: string;
  sabor2?: string;
  sabor3?: string;
  cantidad?: string;
};

type ProductFormProps = {
  product: Product;
  index: number;
  saboresVisibles: number[];
  handleProductChange: (index: number, field: string, value: string) => void;
  setSaboresVisibles: React.Dispatch<React.SetStateAction<number[]>>;
  removeProduct: (index: number) => void;
  pizzaSabores: string[];
  calzoneSabores: string[];
  totalProducts: number;
};

export default function ProductForm({
  product,
  index,
  saboresVisibles,
  handleProductChange,
  setSaboresVisibles,
  removeProduct,
  pizzaSabores,
  calzoneSabores,
  totalProducts,
}: ProductFormProps) {
  const { isMobile } = useBreakpoint();
  return (
    <View style={styles.productContainer}>
      <View style={styles.headerRow}>
        <Text style={styles.productTitle}>Producto {index + 1}</Text>
        {totalProducts > 1 && (
          <TouchableOpacity onPress={() => removeProduct(index)} style={styles.removeBtn}>
            <Text style={styles.removeBtnText}>Eliminar</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.row}>
        {/* TIPO */}
        <View style={[styles.col4, isMobile && styles.col4Mobile]}>
          <Text style={styles.label}>Tipo de producto</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={product.tipo}
              onValueChange={v => handleProductChange(index, 'tipo', v)}
              style={styles.picker}
              itemStyle={{ color: colors.text, fontSize: 16 }}
              dropdownIconColor={colors.text}
            >
              <Picker.Item label="Tipo..." value="" color={colors.subText} />
              <Picker.Item label="Pizza" value="Pizza" />
              <Picker.Item label="Chuzo" value="Chuzo" />
              <Picker.Item label="Calzone" value="Calzone" />
              <Picker.Item label="Hamburguesa" value="Hamburguesa" />
              <Picker.Item label="Pizza Burguer" value="Pizza Burguer" />
              <Picker.Item label="Torti Burger" value="Torti Burger" />
              <Picker.Item label="Kebab" value="Kebab" />
              <Picker.Item label="Pudin" value="Pudin" />
              <Picker.Item label="Varios" value="Varios" />
            </Picker>
          </View>
        </View>

        {/* CANTIDAD (Siempre visible) */}
        <View style={[styles.col4, isMobile && styles.col4Mobile]}>
          <Text style={styles.label}>Cantidad</Text>
          <TextInput
            style={styles.input}
            value={product.cantidad}
            onChangeText={v => handleProductChange(index, 'cantidad', v)}
            placeholder="1"
            placeholderTextColor={colors.subText}
            keyboardType="numeric"
          />
        </View>

        {/* LOGIC PER TYPE */}
        {product.tipo === 'Pizza' && (
          <View style={[styles.col4, isMobile && styles.col4Mobile]}>
            <Text style={styles.label}>Tamaño</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={product.tamano}
                onValueChange={v => handleProductChange(index, 'tamano', v)}
                style={styles.picker}
                itemStyle={{ color: colors.text, fontSize: 16 }}
                dropdownIconColor={colors.text}
              >
                <Picker.Item label="Tamaño..." value="" color={colors.subText} />
                {pizzaTamanos.map(t => <Picker.Item key={t.value} label={t.label} value={t.value} />)}
              </Picker>
            </View>
          </View>
        )}

        {/* HAMBURGUESA TYPE */}
        {product.tipo === 'Hamburguesa' && (
          <View style={[styles.col4, isMobile && styles.col4Mobile]}>
            <Text style={styles.label}>Tipo Ham.</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={product.sabor1}
                onValueChange={v => handleProductChange(index, 'sabor1', v)}
                style={styles.picker}
                itemStyle={{ color: colors.text, fontSize: 16 }}
                dropdownIconColor={colors.text}
              >
                <Picker.Item label="Selección..." value="" color={colors.subText} />
                <Picker.Item label="Sencilla" value="Sencilla" />
                <Picker.Item label="Picosita (Con chorizo)" value="Picosita" />
                <Picker.Item label="Doble carne" value="Doble carne" />
              </Picker>
            </View>
          </View>
        )}
      </View>

      {/* DETALLES EXTRA (Sabores, etc) */}
      {product.tipo !== '' && (
        <View style={styles.row}>
          {product.tipo === 'Pizza' ? (
            <>
              <View style={[styles.col4, isMobile && styles.col4Mobile]}>
                <Text style={styles.label}>Sabor 1</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={product.sabor1}
                    onValueChange={v => handleProductChange(index, 'sabor1', v)}
                    style={styles.picker}
                    itemStyle={{ color: colors.text, fontSize: 16 }}
                    dropdownIconColor={colors.text}
                  >
                    <Picker.Item label="Sabor 1..." value="" color={colors.subText} />
                    {pizzaSabores.map(s => <Picker.Item key={s} label={s} value={s} />)}
                  </Picker>
                </View>
              </View>

              {saboresVisibles[index] > 1 && (
                <View style={[styles.col4, isMobile && styles.col4Mobile]}>
                  <Text style={styles.label}>Sabor 2</Text>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={product.sabor2}
                      onValueChange={v => handleProductChange(index, 'sabor2', v)}
                      style={styles.picker}
                      itemStyle={{ color: colors.text, fontSize: 16 }}
                      dropdownIconColor={colors.text}
                    >
                      <Picker.Item label="Sabor 2..." value="" color={colors.subText} />
                      {pizzaSabores.map(s => <Picker.Item key={s} label={s} value={s} />)}
                    </Picker>
                  </View>
                </View>
              )}
              {saboresVisibles[index] > 2 && (
                <View style={[styles.col4, isMobile && styles.col4Mobile]}>
                  <Text style={styles.label}>Sabor 3</Text>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={product.sabor3}
                      onValueChange={v => handleProductChange(index, 'sabor3', v)}
                      style={styles.picker}
                      itemStyle={{ color: colors.text, fontSize: 16 }}
                      dropdownIconColor={colors.text}
                    >
                      <Picker.Item label="Sabor 3..." value="" color={colors.subText} />
                      {pizzaSabores.map(s => <Picker.Item key={s} label={s} value={s} />)}
                    </Picker>
                  </View>
                </View>
              )}
              {saboresVisibles[index] < 3 && (
                <View style={styles.col12}>
                  <TouchableOpacity onPress={() => setSaboresVisibles(sv => sv.map((n, i) => i === index ? n + 1 : n))} style={styles.addFlavorBtn}>
                    <Text style={styles.addFlavorBtnText}>+ Añadir otro sabor</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          ) : product.tipo === 'Chuzo' ? (
            <View style={[styles.col6, isMobile && styles.col6Mobile]}>
              <Text style={styles.label}>Sabor</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={product.sabor1}
                  onValueChange={v => handleProductChange(index, 'sabor1', v)}
                  style={styles.picker}
                  itemStyle={{ color: colors.text, fontSize: 16 }}
                  dropdownIconColor={colors.text}
                >
                  <Picker.Item label="Sabor..." value="" color={colors.subText} />
                  <Picker.Item label="Mixto" value="Mixto" />
                  <Picker.Item label="Pollo y tocineta" value="Pollo y tocineta" />
                </Picker>
              </View>
            </View>
          ) : product.tipo === 'Calzone' ? (
            <>
              <View style={[styles.col6, isMobile && styles.col6Mobile]}>
                <Text style={styles.label}>Sabor 1</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={product.sabor1}
                    onValueChange={v => handleProductChange(index, 'sabor1', v)}
                    style={styles.picker}
                    itemStyle={{ color: colors.text, fontSize: 16 }}
                    dropdownIconColor={colors.text}
                  >
                    <Picker.Item label="Seleccione sabor 1" value="" color={colors.subText} />
                    {calzoneSabores.map(s => <Picker.Item key={s} label={s} value={s} />)}
                  </Picker>
                </View>
              </View>
              {saboresVisibles[index] > 1 && (
                <View style={[styles.col6, isMobile && styles.col6Mobile]}>
                  <Text style={styles.label}>Sabor 2</Text>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={product.sabor2}
                      onValueChange={v => handleProductChange(index, 'sabor2', v)}
                      style={styles.picker}
                      itemStyle={{ color: colors.text, fontSize: 16 }}
                      dropdownIconColor={colors.text}
                    >
                      <Picker.Item label="Seleccione sabor 2" value="" color={colors.subText} />
                      {calzoneSabores.map(s => <Picker.Item key={s} label={s} value={s} />)}
                    </Picker>
                  </View>
                </View>
              )}
              {saboresVisibles[index] < 2 && (
                <View style={styles.col12}>
                  <TouchableOpacity onPress={() => setSaboresVisibles(sv => sv.map((n, i) => i === index ? n + 1 : n))} style={styles.addFlavorBtn}>
                    <Text style={styles.addFlavorBtnText}>+ Añadir sabor</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          ) : product.tipo === 'Kebab' || product.tipo === 'Torti Burger' || product.tipo === 'Hamburguesa' ? (
            <></>
          ) : (
            <>
              {/* Varios / Generic inputs layout */}
              <View style={styles.col4}>
                <TextInput style={styles.input} value={product.tamano} onChangeText={v => handleProductChange(index, 'tamano', v)} placeholder="Tamaño/Detalle" placeholderTextColor={colors.subText} />
              </View>
              <View style={styles.col4}>
                <TextInput style={styles.input} value={product.sabor1} onChangeText={v => handleProductChange(index, 'sabor1', v)} placeholder="Sabor 1 (Op)" placeholderTextColor={colors.subText} />
              </View>
              <View style={styles.col4}>
                <TextInput style={styles.input} value={product.sabor2} onChangeText={v => handleProductChange(index, 'sabor2', v)} placeholder="Sabor 2 (Op)" placeholderTextColor={colors.subText} />
              </View>
            </>
          )}
        </View>
      )}
    </View>
  );
}

// styles imported from ProductForm.styles
