export interface EstimateTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  steps: EstimateStep[];
  calculationRules: CalculationRule[];
}

export interface EstimateStep {
  id: string;
  title: string;
  description?: string;
  fields: EstimateField[];
  conditionalOn?: {
    fieldId: string;
    value: any;
  };
}

export interface EstimateField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'radio' | 'checkbox' | 'measurement';
  required: boolean;
  options?: string[];
  unit?: string;
  placeholder?: string;
  helpText?: string;
}

export interface CalculationRule {
  id: string;
  description: string;
  type: 'material_quantity' | 'line_item' | 'markup' | 'conditional_fee';
  trigger: {
    fieldId: string;
    condition?: string;
    value?: any;
  };
  calculation: {
    formula: string; // e.g., "squareFootage * 0.5" for gravel
    productId?: string;
    basePrice?: number;
    markupPercent?: number;
    unit?: string;
  };
  conditionalOn?: {
    fieldId: string;
    value: any;
  };
}

export interface Product {
  id: string;
  name: string;
  category: string;
  unit: string;
  materialCost: number;
  laborCost: number;
  markupPercent: number;
  totalCost: number; // materialCost + laborCost
  pricePerUnit: number; // totalCost * (1 + markupPercent/100)
  description?: string;
  isHiddenFromClient?: boolean;
}

// Product Catalog
export const products: Product[] = [
  {
    id: 'p1',
    name: 'Concrete Mix (3000 PSI)',
    category: 'Concrete',
    unit: 'cubic yard',
    materialCost: 125,
    laborCost: 0,
    markupPercent: 30,
    totalCost: 125,
    pricePerUnit: 162.50,
    isHiddenFromClient: false,
  },
  {
    id: 'p2',
    name: 'Gravel Base (3/4")',
    category: 'Concrete',
    unit: 'ton',
    materialCost: 35,
    laborCost: 0,
    markupPercent: 40,
    totalCost: 35,
    pricePerUnit: 49,
    isHiddenFromClient: false,
  },
  {
    id: 'p3',
    name: 'Rebar (#4)',
    category: 'Concrete',
    unit: 'linear foot',
    materialCost: 0.85,
    laborCost: 0,
    markupPercent: 50,
    totalCost: 0.85,
    pricePerUnit: 1.28,
    isHiddenFromClient: false,
  },
  {
    id: 'p4',
    name: 'Wire Mesh (6x6)',
    category: 'Concrete',
    unit: 'square foot',
    materialCost: 0.35,
    laborCost: 0,
    markupPercent: 45,
    totalCost: 0.35,
    pricePerUnit: 0.51,
    isHiddenFromClient: false,
  },
  {
    id: 'p5',
    name: 'Concrete Sealer',
    category: 'Concrete',
    unit: 'square foot',
    materialCost: 0.15,
    laborCost: 0.10,
    markupPercent: 60,
    totalCost: 0.25,
    pricePerUnit: 0.40,
    isHiddenFromClient: false,
  },
  {
    id: 'p6',
    name: 'Labor - Concrete Pour',
    category: 'Labor',
    unit: 'hour',
    materialCost: 0,
    laborCost: 45,
    markupPercent: 100,
    totalCost: 45,
    pricePerUnit: 90,
    isHiddenFromClient: false,
  },
  {
    id: 'p7',
    name: 'Equipment - Concrete Pump',
    category: 'Equipment',
    unit: 'day',
    materialCost: 350,
    laborCost: 0,
    markupPercent: 30,
    totalCost: 350,
    pricePerUnit: 455,
    isHiddenFromClient: false,
  },
  {
    id: 'p8',
    name: 'Line Pump Fee',
    category: 'Equipment',
    unit: 'flat',
    materialCost: 400,
    laborCost: 0,
    markupPercent: 25,
    totalCost: 400,
    pricePerUnit: 500,
    description: 'Required for backyard pours',
    isHiddenFromClient: false,
  },
];

// Estimate Templates
export const estimateTemplates: EstimateTemplate[] = [
  {
    id: 'concrete-template',
    name: 'Concrete Work',
    category: 'Concrete',
    description: 'Driveway, Patio, Walkway, Pool Deck',
    steps: [
      {
        id: 'step1',
        title: 'Project Type',
        description: 'Select the type of concrete work',
        fields: [
          {
            id: 'projectType',
            label: 'What type of concrete project?',
            type: 'radio',
            required: true,
            options: ['Driveway', 'Patio', 'Walkway', 'Pool Deck', 'Other'],
          },
        ],
      },
      {
        id: 'step2',
        title: 'Location & Access',
        description: 'Help us understand the project location',
        fields: [
          {
            id: 'location',
            label: 'Project Location',
            type: 'radio',
            required: true,
            options: ['Front Yard', 'Backyard', 'Side Yard'],
            helpText: 'Location affects equipment access and pump requirements',
          },
          {
            id: 'accessWidth',
            label: 'Access Width (feet)',
            type: 'number',
            required: true,
            placeholder: '8',
            helpText: 'Width of narrowest access point to work area',
          },
        ],
      },
      {
        id: 'step3',
        title: 'Measurements',
        description: 'Enter the dimensions of the concrete area',
        fields: [
          {
            id: 'length',
            label: 'Length',
            type: 'number',
            required: true,
            unit: 'feet',
            placeholder: '20',
          },
          {
            id: 'width',
            label: 'Width',
            type: 'number',
            required: true,
            unit: 'feet',
            placeholder: '15',
          },
          {
            id: 'thickness',
            label: 'Concrete Thickness',
            type: 'select',
            required: true,
            unit: 'inches',
            options: ['4', '5', '6', '8'],
            helpText: 'Standard driveway: 6", Patio: 4-5"',
          },
        ],
      },
      {
        id: 'step4',
        title: 'Reinforcement',
        description: 'Select reinforcement options',
        fields: [
          {
            id: 'reinforcementType',
            label: 'Reinforcement Type',
            type: 'radio',
            required: true,
            options: ['Wire Mesh', 'Rebar', 'Both', 'None'],
          },
          {
            id: 'rebarSpacing',
            label: 'Rebar Spacing',
            type: 'select',
            required: false,
            options: ['12 inches', '16 inches', '24 inches'],
            helpText: 'Only if rebar is selected',
          },
        ],
      },
      {
        id: 'step5',
        title: 'Finishing & Options',
        description: 'Select finish and additional options',
        fields: [
          {
            id: 'finish',
            label: 'Concrete Finish',
            type: 'select',
            required: true,
            options: ['Broom Finish', 'Smooth Trowel', 'Exposed Aggregate', 'Stamped', 'Stained'],
          },
          {
            id: 'sealer',
            label: 'Apply Sealer?',
            type: 'radio',
            required: true,
            options: ['Yes', 'No'],
            helpText: 'Recommended for protection and longevity',
          },
          {
            id: 'colorAdditive',
            label: 'Color Additive?',
            type: 'radio',
            required: true,
            options: ['Yes', 'No'],
          },
        ],
      },
    ],
    calculationRules: [
      {
        id: 'calc1',
        description: 'Calculate square footage',
        type: 'material_quantity',
        trigger: {
          fieldId: 'width',
        },
        calculation: {
          formula: 'length * width',
          unit: 'square feet',
        },
      },
      {
        id: 'calc2',
        description: 'Calculate concrete needed (cubic yards)',
        type: 'material_quantity',
        trigger: {
          fieldId: 'thickness',
        },
        calculation: {
          formula: '(length * width * (thickness / 12)) / 27',
          productId: 'p1',
          unit: 'cubic yards',
        },
      },
      {
        id: 'calc3',
        description: 'Calculate gravel base (tons)',
        type: 'material_quantity',
        trigger: {
          fieldId: 'thickness',
        },
        calculation: {
          formula: '(length * width * 4 / 12) / 27 * 1.35',
          productId: 'p2',
          unit: 'tons',
        },
      },
      {
        id: 'calc4',
        description: 'Add line pump fee for backyard',
        type: 'conditional_fee',
        trigger: {
          fieldId: 'location',
          value: 'Backyard',
        },
        calculation: {
          formula: '1',
          productId: 'p8',
          unit: 'flat',
        },
        conditionalOn: {
          fieldId: 'location',
          value: 'Backyard',
        },
      },
      {
        id: 'calc5',
        description: 'Calculate sealer coverage',
        type: 'material_quantity',
        trigger: {
          fieldId: 'sealer',
          value: 'Yes',
        },
        calculation: {
          formula: 'length * width',
          productId: 'p5',
          unit: 'square feet',
        },
        conditionalOn: {
          fieldId: 'sealer',
          value: 'Yes',
        },
      },
    ],
  },
  {
    id: 'outdoor-kitchen-template',
    name: 'Outdoor Kitchen',
    category: 'Outdoor Kitchen',
    description: 'Custom outdoor kitchen with grill, countertops, and appliances',
    steps: [
      {
        id: 'step1',
        title: 'Kitchen Layout',
        fields: [
          {
            id: 'layoutType',
            label: 'Layout Configuration',
            type: 'radio',
            required: true,
            options: ['L-Shape', 'U-Shape', 'Straight Line', 'Island'],
          },
          {
            id: 'linearFeet',
            label: 'Total Linear Feet',
            type: 'number',
            required: true,
            unit: 'feet',
            placeholder: '12',
          },
        ],
      },
      {
        id: 'step2',
        title: 'Appliances',
        fields: [
          {
            id: 'grill',
            label: 'Built-in Grill',
            type: 'select',
            required: true,
            options: ['None', 'Basic (32")', 'Premium (36")', 'Deluxe (42")'],
          },
          {
            id: 'sideBurner',
            label: 'Side Burner',
            type: 'radio',
            required: true,
            options: ['Yes', 'No'],
          },
          {
            id: 'refrigerator',
            label: 'Outdoor Refrigerator',
            type: 'radio',
            required: true,
            options: ['Yes', 'No'],
          },
        ],
      },
    ],
    calculationRules: [],
  },
  {
    id: 'pergola-template',
    name: 'Pergola/Pavilion',
    category: 'Structures',
    description: 'Custom pergola or pavilion construction',
    steps: [
      {
        id: 'step1',
        title: 'Structure Type',
        fields: [
          {
            id: 'structureType',
            label: 'What would you like to build?',
            type: 'radio',
            required: true,
            options: ['Pergola (Open Top)', 'Pavilion (Covered)', 'Gazebo'],
          },
        ],
      },
      {
        id: 'step2',
        title: 'Size & Dimensions',
        fields: [
          {
            id: 'length',
            label: 'Length',
            type: 'number',
            required: true,
            unit: 'feet',
          },
          {
            id: 'width',
            label: 'Width',
            type: 'number',
            required: true,
            unit: 'feet',
          },
          {
            id: 'height',
            label: 'Height',
            type: 'number',
            required: true,
            unit: 'feet',
            placeholder: '10',
          },
        ],
      },
    ],
    calculationRules: [],
  },
];