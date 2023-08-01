// Import required modules
import express, { json, urlencoded } from "express";
import cors from "cors";
import { config } from "dotenv";
import { MongoClient, ServerApiVersion, ObjectId } from "mongodb";

// Load environment variables from .env file
config();

// Create the Express app
const app = express();

// Set up CORS middleware
app.use(cors());
app.use(json());
app.use(urlencoded({ extended: true }));

// Connect to MongoDB
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.otylb.mongodb.net/?retryWrites=true&w=majority`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// helper functions
function calculateReviews(products) {
  products.forEach((product) => {
    const reviews = product.reviews;
    if (reviews && reviews.length > 0) {
      const totalRating = reviews.reduce(
        (sum, review) => sum + review.rating,
        0
      );
      const averageRating = totalRating / reviews.length;
      product.averageRating = averageRating;
    } else {
      product.averageRating = 0; // Set default average rating to 0 if there are no reviews
    }
  });
  return products;
}

function calculateReview(product) {
  const reviews = product.reviews;
  if (reviews && reviews.length > 0) {
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = totalRating / reviews.length;
    product.averageRating = averageRating;
  } else {
    product.averageRating = 0; // Set default average rating to 0 if there are no reviews
  }
  return product;
}

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect().then(console.log("DB Connected successfully!"));

    const db = client.db("pc-builder");
    const productCollection = db.collection("products");
    const categoriesCollection = db.collection("categories");

    app.get("/", async (req, res) => {
      res.json({ success: true });
    });

    // ==============================================
    // Get all the products
    // ==============================================
    app.get("/api/v1/products", async (req, res) => {
      const products = await productCollection.find({}).toArray();
      res.json(products);
    });

    // ==============================================
    // Get featured products
    // ==============================================
    app.get("/api/v1/products/featured", async (req, res) => {
      const products = await productCollection
        .aggregate([
          { $sample: { size: 6 } },
          {
            $project: {
              _id: 1,
              image: 1,
              productName: 1,
              category: 1,
              price: 1,
              status: 1,
              reviews: 1,
            },
          },
        ])
        .toArray();

      calculateReviews(products);
      res.json(products);
    });

    // ==============================================
    // Get all the products of a category
    // ==============================================
    app.get("/api/v1/products/categories/:category", async (req, res) => {
      // correcting params as per category field in database
      let categoryParam = req.params.category;
      let products;

      const categories = await categoriesCollection.find({}).toArray();

      if (categoryParam === "others") {
        const categoryTitles = categories.map((category) => category.title);
        products = await productCollection
          .find({
            $or: [
              { category: { $nin: categoryTitles } },
              { category: "Others" },
            ],
          })
          .toArray();
      } else {
        const category = categories.find(
          (category) => category.slug === categoryParam
        );

        if (category) {
          products = await productCollection
            .find({ category: category.title })
            .toArray();
        }
      }
      calculateReviews(products);

      res.json(products);
    });

    // ==============================================
    // Get a single product
    // ==============================================
    app.get("/api/v1/products/:id", async (req, res) => {
      const id = req.params.id;
      const product = await productCollection.findOne({
        _id: new ObjectId(id),
      });
      calculateReview(product);
      res.json(product);
    });

    // ==============================================
    // Get all the categories
    // ==============================================
    app.get("/api/v1/categories", async (req, res) => {
      const categories = await categoriesCollection.find({}).toArray();
      res.json(categories);
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

// Start the server
const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
