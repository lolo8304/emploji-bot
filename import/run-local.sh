SCRIPT_TO_RUN=$1
if [ -z "${SCRIPT_TO_RUN}" ]; then
	echo "call run.sh script with parameter eg import.js"
	exit 1
fi
#uncomment if your local mongodb has user / password rights
#read -s  -p "enter Mongo-Admin user:" usr
#read -s  -p "enter Mongo-Admin password:" pwd
#mongo localhost:27018/emploji-bot -u $usr -p $pwd ${SCRIPT_TO_RUN}

#use if no user / password is needed
mongo localhost:27018/emploji-bot ${SCRIPT_TO_RUN}
