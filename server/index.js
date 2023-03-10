require('dotenv').config()
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const router = require('./router/index');
const errorMiddleware = require('./middlewares/error-middleware');


const specs = require('./swagger/index');
const swaggerUi = require("swagger-ui-express");

const PORT = process.env.PORT || 5000;
const app = express()

app.use(express.json());
app.use(cookieParser());
app.use(cors());
app.use('/api', router);
app.use(errorMiddleware);

const start = async () => {
	try {
		await mongoose.connect(process.env.DB_URL, {
			useNewUrlParser: true,
			useUnifiedTopology: true,
			family: 4
		})
		app.listen(PORT, () => console.log(`Server start = ${PORT}`))
		app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs, { explorer: true }));
	} catch (e){
		console.log(e);
	}
}



start()