import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { SectionCard } from '../../components/ui/SectionCard';
import { useAuth } from '../auth/AuthContext';
import { useProductFormData, useProductMutations, useProducts } from './useProducts';
import type { Product, ProductPayload } from '../../types/product';

const EMPTY_PRODUCT_FORM: ProductPayload = {
  sku: '',
  barcode: '',
  name: '',
  description: '',
  short_description: '',
  color: '',
  category_id: '',
  category_primary_id: '',
  category_ids: [],
  brand_id: '',
  supplier: '',
  purchase_price: '0',
  sale_price: '0',
  sale_price_2: '0',
  sale_price_3: '0',
  sale_price_4: '0',
  sale_price_5: '0',
  sale_price_6: '0',
  sale_price_includes_tax: true,
  stock: '0',
  min_stock: '2',
  image_url: ''
};

function toProductFormValues(product: Product | null): ProductPayload {
  if (!product) return { ...EMPTY_PRODUCT_FORM };

  return {
    sku: product.sku || '',
    barcode: product.barcode || '',
    name: product.name || '',
    description: product.description || '',
    short_description: product.short_description || '',
    color: product.color || '',
    category_id: product.category_id != null ? String(product.category_id) : '',
    category_primary_id: product.category_primary_id != null ? String(product.category_primary_id) : '',
    category_ids: Array.isArray(product.category_ids) ? product.category_ids.map(String) : [],
    brand_id: product.brand_id != null ? String(product.brand_id) : '',
    supplier: product.supplier || '',
    purchase_price: String(product.purchase_price ?? 0),
    sale_price: String(product.sale_price ?? 0),
    sale_price_2: String(product.sale_price_2 ?? 0),
    sale_price_3: String(product.sale_price_3 ?? 0),
    sale_price_4: String(product.sale_price_4 ?? 0),
    sale_price_5: String(product.sale_price_5 ?? 0),
    sale_price_6: String(product.sale_price_6 ?? 0),
    sale_price_includes_tax: product.sale_price_includes_tax !== false && Number(product.sale_price_includes_tax ?? 1) === 1,
    stock: String(product.stock ?? 0),
    min_stock: String(product.min_stock ?? 2),
    image_url: product.image_url || ''
  };
}

function normalizeProductPayload(values: ProductPayload) {
  const categoryIds = [...new Set([values.category_primary_id || values.category_id, ...values.category_ids].filter(Boolean))];

  return {
    sku: values.sku.trim(),
    barcode: values.barcode.trim(),
    name: values.name.trim(),
    description: values.description.trim(),
    short_description: values.short_description.trim(),
    color: values.color.trim(),
    category_id: values.category_primary_id || values.category_id || null,
    category_primary_id: values.category_primary_id || values.category_id || null,
    category_ids: categoryIds,
    brand_id: values.brand_id || null,
    supplier: values.supplier.trim(),
    purchase_price: Number(values.purchase_price || 0),
    sale_price: Number(values.sale_price || 0),
    sale_price_2: Number(values.sale_price_2 || 0),
    sale_price_3: Number(values.sale_price_3 || 0),
    sale_price_4: Number(values.sale_price_4 || 0),
    sale_price_5: Number(values.sale_price_5 || 0),
    sale_price_6: Number(values.sale_price_6 || 0),
    sale_price_includes_tax: values.sale_price_includes_tax,
    stock: Number(values.stock || 0),
    min_stock: Number(values.min_stock || 0),
    image_url: values.image_url.trim(),
    images: values.image_url.trim()
      ? [{ url_remote: values.image_url.trim(), es_principal: true }]
      : []
  };
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2
  }).format(Number(value || 0));
}

export function ProductsPage() {
  const { currentUser } = useAuth();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [formValues, setFormValues] = useState<ProductPayload>({ ...EMPTY_PRODUCT_FORM });
  const [feedback, setFeedback] = useState('');
  const productsQuery = useProducts({
    search,
    category: categoryFilter,
    lowStock: lowStockOnly
  });
  const { categoriesQuery, brandsQuery, nextSkuQuery } = useProductFormData();
  const { createMutation, updateMutation, deleteMutation } = useProductMutations();

  const products = productsQuery.data || [];
  const categories = categoriesQuery.data || [];
  const brands = brandsQuery.data || [];
  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isDeleting = deleteMutation.isPending;
  const isAdmin = currentUser?.role === 'admin';

  const sortedProducts = useMemo(
    () => products.slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))),
    [products]
  );

  function handleCreateNew() {
    const suggestedSku = nextSkuQuery.data?.sku || '';
    setSelectedProduct(null);
    setFormValues({
      ...EMPTY_PRODUCT_FORM,
      sku: suggestedSku
    });
    setFeedback('');
  }

  function handleEdit(product: Product) {
    setSelectedProduct(product);
    setFormValues(toProductFormValues(product));
    setFeedback('');
  }

  function handleChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = event.target;

    if (name === 'category_primary_id') {
      setFormValues((current) => ({
        ...current,
        category_primary_id: value,
        category_id: value,
        category_ids: value ? [value] : []
      }));
      return;
    }

    if (name === 'sale_price_includes_tax') {
      const checkbox = event.target as HTMLInputElement;
      setFormValues((current) => ({
        ...current,
        sale_price_includes_tax: checkbox.checked
      }));
      return;
    }

    setFormValues((current) => ({
      ...current,
      [name]: value
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback('');

    if (!formValues.name.trim()) {
      setFeedback('La descripcion del articulo es obligatoria.');
      return;
    }

    if (!isAdmin) {
      setFeedback('Solo el administrador puede guardar articulos desde este modulo.');
      return;
    }

    const payload = normalizeProductPayload(formValues);

    try {
      const response = selectedProduct
        ? await updateMutation.mutateAsync({ id: selectedProduct.id, payload })
        : await createMutation.mutateAsync(payload);

      const warning = response.sync_warning ? ` Guardado localmente. Aviso Woo: ${response.sync_warning}` : '';
      setFeedback(`${selectedProduct ? 'Articulo actualizado' : 'Articulo creado'} correctamente.${warning}`);
      handleCreateNew();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo guardar el articulo.');
    }
  }

  async function handleDelete(product: Product) {
    if (!isAdmin) {
      setFeedback('Solo el administrador puede eliminar articulos.');
      return;
    }

    const confirmed = window.confirm(`Eliminar el articulo ${product.name}?`);
    if (!confirmed) return;

    try {
      const result = await deleteMutation.mutateAsync(product.id);
      setFeedback(result.remote_delete_warning ? `Articulo eliminado localmente. Aviso Woo: ${result.remote_delete_warning}` : 'Articulo eliminado correctamente.');
      if (selectedProduct?.id === product.id) {
        handleCreateNew();
      }
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'No se pudo eliminar el articulo.');
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <SectionCard title="Articulos" description="Planilla principal modernizada usando el endpoint actual de products.">
        <div className="mb-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto_auto]">
          <input
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
            placeholder="Buscar por SKU, descripcion o marca"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />

          <select
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
          >
            <option value="">Todas las categorias</option>
            {categories.map((category) => (
              <option key={category.id} value={String(category.id)}>
                {category.full_name || category.name}
              </option>
            ))}
          </select>

          <label className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(event) => setLowStockOnly(event.target.checked)}
            />
            Solo stock bajo
          </label>

          <button
            type="button"
            onClick={handleCreateNew}
            className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Nuevo articulo
          </button>
        </div>

        {productsQuery.isLoading ? (
          <Notice text="Cargando articulos..." />
        ) : productsQuery.isError ? (
          <ErrorNotice text={productsQuery.error instanceof Error ? productsQuery.error.message : 'No se pudieron cargar articulos.'} />
        ) : sortedProducts.length === 0 ? (
          <Notice text="No hay articulos para mostrar." />
        ) : (
          <div className="space-y-3">
            {sortedProducts.map((product) => (
              <article key={product.id} className="rounded-2xl border border-slate-200 px-4 py-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <h3 className="truncate font-medium text-slate-900">{product.name}</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {[product.sku, product.brand_name, product.supplier].filter(Boolean).join(' · ') || 'Sin metadatos'}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {(product.category_names || []).join(', ') || product.category_name || 'Sin categoria'}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                      <span className="rounded-full bg-slate-100 px-3 py-1">Stock {product.stock ?? 0}</span>
                      <span className="rounded-full bg-slate-100 px-3 py-1">Min {product.min_stock ?? 0}</span>
                      <span className="rounded-full bg-slate-100 px-3 py-1">Costo {formatMoney(Number(product.purchase_price || 0))}</span>
                      <span className="rounded-full bg-slate-100 px-3 py-1">Lista 1 {formatMoney(Number(product.sale_price || 0))}</span>
                      <span className={`rounded-full px-3 py-1 ${product.sync_status === 'error' ? 'bg-rose-100 text-rose-700' : product.sync_status === 'synced' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        Sync {product.sync_status || 'pending'}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleEdit(product)}
                      className="rounded-full border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(product)}
                      disabled={isDeleting}
                      className="rounded-full border border-rose-300 px-3 py-2 text-xs font-medium text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title={selectedProduct ? 'Editar articulo' : 'Nuevo articulo'}
        description="Formulario base compatible con el payload actual. Sync Woo manual y herramientas avanzadas siguen fuera de esta fase."
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="SKU" name="sku" value={formValues.sku} onChange={handleChange} />
            <Field label="Codigo de barras" name="barcode" value={formValues.barcode} onChange={handleChange} />
            <Field className="md:col-span-2" label="Descripcion" name="name" value={formValues.name} onChange={handleChange} required />
            <Field className="md:col-span-2" label="Descripcion corta" name="short_description" value={formValues.short_description} onChange={handleChange} />
            <Field label="Color" name="color" value={formValues.color} onChange={handleChange} />
            <Field label="Proveedor" name="supplier" value={formValues.supplier} onChange={handleChange} />
            <SelectField label="Categoria principal" name="category_primary_id" value={formValues.category_primary_id} onChange={handleChange} options={categories.map((item) => ({ value: String(item.id), label: item.full_name || item.name }))} />
            <SelectField label="Marca" name="brand_id" value={formValues.brand_id} onChange={handleChange} options={brands.map((item) => ({ value: String(item.id), label: item.name }))} />
            <Field label="Costo" name="purchase_price" type="number" value={formValues.purchase_price} onChange={handleChange} />
            <Field label="Lista 1" name="sale_price" type="number" value={formValues.sale_price} onChange={handleChange} />
            <Field label="Lista 2" name="sale_price_2" type="number" value={formValues.sale_price_2} onChange={handleChange} />
            <Field label="Lista 3" name="sale_price_3" type="number" value={formValues.sale_price_3} onChange={handleChange} />
            <Field label="Lista 4" name="sale_price_4" type="number" value={formValues.sale_price_4} onChange={handleChange} />
            <Field label="Lista 5" name="sale_price_5" type="number" value={formValues.sale_price_5} onChange={handleChange} />
            <Field label="Lista 6" name="sale_price_6" type="number" value={formValues.sale_price_6} onChange={handleChange} />
            <Field label="Stock" name="stock" type="number" value={formValues.stock} onChange={handleChange} />
            <Field label="Stock minimo" name="min_stock" type="number" value={formValues.min_stock} onChange={handleChange} />
            <Field className="md:col-span-2" label="URL de imagen principal" name="image_url" value={formValues.image_url} onChange={handleChange} />
            <label className="md:col-span-2 inline-flex items-center gap-2 rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                name="sale_price_includes_tax"
                checked={formValues.sale_price_includes_tax}
                onChange={handleChange}
              />
              Lista 1 incluye impuestos
            </label>
          </div>

          {feedback ? <InlineFeedback text={feedback} tone={feedback.includes('No ') || feedback.includes('Solo ') ? 'error' : 'info'} /> : null}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={!isAdmin || isSaving}
              className="inline-flex items-center justify-center rounded-2xl bg-brand px-4 py-3 text-sm font-medium text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? 'Guardando...' : selectedProduct ? 'Guardar cambios' : 'Crear articulo'}
            </button>
            <button
              type="button"
              onClick={handleCreateNew}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Limpiar
            </button>
          </div>
        </form>
      </SectionCard>
    </div>
  );
}

function Field({ className = '', label, name, value, onChange, type = 'text', required = false }: FieldProps) {
  return (
    <label className={`block ${className}`.trim()}>
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <input
        className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        required={required}
      />
    </label>
  );
}

function SelectField({ label, name, value, onChange, options }: SelectFieldProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <select
        className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
        name={name}
        value={value}
        onChange={onChange}
      >
        <option value="">Seleccionar</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Notice({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">{text}</div>;
}

function ErrorNotice({ text }: { text: string }) {
  return <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-700">{text}</div>;
}

function InlineFeedback({ text, tone }: { text: string; tone: 'info' | 'error' }) {
  return (
    <div className={`rounded-2xl px-4 py-3 text-sm ${tone === 'error' ? 'border border-rose-200 bg-rose-50 text-rose-700' : 'border border-sky-200 bg-sky-50 text-sky-700'}`}>
      {text}
    </div>
  );
}

interface FieldProps {
  className?: string;
  label: string;
  name: keyof ProductPayload;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  type?: 'text' | 'number';
  required?: boolean;
}

interface SelectFieldProps {
  label: string;
  name: keyof ProductPayload;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  options: Array<{ value: string; label: string }>;
}
