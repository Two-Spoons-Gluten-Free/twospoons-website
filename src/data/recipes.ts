export type Ingredient = { name: string; weight: string; volume?: string };
export type Recipe = { title: string; ingredients: Ingredient[]; customerAdds?: string; directions?: string; note?: string };

export const flourBlend: Recipe = {
  title: 'All-purpose gluten-free flour blend',
  ingredients: [
    {name:'White rice flour', weight:'240 g', volume:'1 1/2 cups'},
    {name:'Brown rice flour', weight:'160 g', volume:'1 cup'},
    {name:'Potato starch (not potato flour)', weight:'120 g', volume:'1 cup'},
    {name:'Tapioca starch/flour', weight:'80 g', volume:'2/3 cup'},
    {name:'Psyllium husk powder', weight:'12 g', volume:'1 1/2 tbsp'},
  ],
  note:'This is the gluten-free foundation for our cookie and banana bread mixes.',
};

export const recipes: Record<string, Recipe> = {
  'chocolate-chip-cookies': {
    title:'Chocolate chip cookie mix',
    ingredients:[
      {name:'Gluten-free all-purpose blend', weight:'350 g'},
      {name:'Brown sugar', weight:'150 g'},
      {name:'Granulated sugar', weight:'75 g'},
      {name:'Baking soda', weight:'5 g (1 tsp)'},
      {name:'Salt', weight:'4 g (3/4 tsp)'},
      {name:'Certified gluten-free chocolate chips', weight:'200 g'},
    ],
    customerAdds:'1 stick (113 g) softened butter, 1 large egg, and 1 tsp vanilla.',
    directions:'Mix, then let the dough rest 10-15 minutes so the psyllium can hydrate and bind. Scoop and bake at 350 F / 175 C for 10-12 minutes.',
  },
  'banana-bread': {
    title:'Banana bread / quick bread mix',
    ingredients:[
      {name:'Gluten-free all-purpose blend', weight:'320 g'},
      {name:'Sugar', weight:'150 g'},
      {name:'Baking soda', weight:'5 g (1 tsp)'},
      {name:'Salt', weight:'4 g (3/4 tsp)'},
      {name:'Cinnamon', weight:'3 g (1 tsp)'},
      {name:'Psyllium husk powder', weight:'3 g (1 tsp)'},
    ],
    customerAdds:'3 ripe mashed bananas, 2 eggs, 1/3 cup oil, and 1 tsp vanilla.',
    directions:'Mix and let the batter rest 10 minutes before pouring into a loaf pan so the psyllium can bind. Bake at 350 F / 175 C for about 55-60 minutes.',
  },
  'all-purpose-seasoning': {
    title:'All-purpose seasoning',
    ingredients:[
      {name:'Salt', weight:'60 g', volume:'1/4 cup'}, {name:'Garlic powder', weight:'30 g', volume:'3 tbsp'},
      {name:'Onion powder', weight:'30 g', volume:'3 tbsp'}, {name:'Black pepper', weight:'15 g', volume:'2 tbsp'},
      {name:'Paprika', weight:'20 g', volume:'2 1/2 tbsp'}, {name:'Dried thyme', weight:'6 g', volume:'2 tbsp'},
      {name:'Dried oregano', weight:'6 g', volume:'2 tbsp'},
    ],
  },
  'taco-seasoning': {
    title:'Taco seasoning',
    ingredients:[
      {name:'Chili powder', weight:'40 g', volume:'4 tbsp'}, {name:'Cumin', weight:'25 g', volume:'3 tbsp'},
      {name:'Paprika', weight:'15 g', volume:'2 tbsp'}, {name:'Garlic powder', weight:'20 g', volume:'2 tbsp'},
      {name:'Onion powder', weight:'20 g', volume:'2 tbsp'}, {name:'Salt', weight:'25 g', volume:'1 1/2 tbsp'},
      {name:'Oregano', weight:'5 g', volume:'1 1/2 tsp'}, {name:'Cayenne, adjusted to heat preference', weight:'3 g', volume:'1 tsp'},
    ],
    note:'We are exploring mild, medium, hot, and non-spicy versions.',
  },
};