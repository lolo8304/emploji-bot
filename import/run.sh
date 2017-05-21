SCRIPT_TO_RUN=$1
if [ -z "${SCRIPT_TO_RUN}" ]; then
	echo "call run.sh script with parameter eg import.js"
	exit 1
fi
 
read -s  -p "enter emploji-admin password:" pwd
mongo ds117189.mlab.com:17189/emploji-bot -u emploji-admin -p $pwd ${SCRIPT_TO_RUN}
