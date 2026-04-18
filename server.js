import app from "./app";
import {sequelize} from "./config/db";

const PORT = process.env.PORT || 5000

const startServer = async () => {
    try {
        await sequelize.authenticate();
        console.log('Database Connected');

        if(process.env.NODE_ENV !== 'test'){
            await sequelize.sync()
            console.log('Table Synced');

        }

        app.listen(PORT,()=>{
            console.log(`Server is running on port ${PORT}`);
        })

    } catch (err) {
        console.log("Error in starting server:",err);

    }
}

startServer()