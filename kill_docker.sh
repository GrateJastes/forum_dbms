sudo docker rmi -f $(sudo docker images -a -q)
sudo docker rm $(sudo docker ps -a -q)
sudo docker volume prune
